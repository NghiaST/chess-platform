import { Chess } from 'chess.js';
import { GameStatus, GameResult } from '@prisma/client';
import { GameRepository } from '../repositories/game.repository';
import { UserRepository } from '../repositories/user.repository';
import { AppError } from '../middlewares/errorHandler';
import { getBotMove } from './bot.service';
import { getBotRating, computeEloChange } from './elo.service';

const gameRepo = new GameRepository();
const userRepo = new UserRepository();

/**
 * Compute and persist an ELO change for the human player after a bot game ends.
 * The human is always white in bot games.
 * Returns the integer rating delta (positive = gain, negative = loss).
 */
async function applyBotGameElo(
  userId: string,
  gameId: string,
  playerRating: number,
  botLevel: number,
  gameResult: GameResult,
): Promise<number> {
  const botRating = getBotRating(botLevel);
  const score =
    gameResult === GameResult.WHITE_WIN ? 1
    : gameResult === GameResult.DRAW ? 0.5
    : 0;
  const { newRating, delta } = computeEloChange(playerRating, botRating, score);
  await Promise.all([
    userRepo.updateRating(userId, newRating),
    gameRepo.createRatingHistory({ userId, gameId, ratingBefore: playerRating, ratingAfter: newRating }),
  ]);
  return delta;
}

interface CreateGameDto {
  userId: string;
  isBotGame: boolean;
  botLevel: number;
  mode?: 'standard' | 'practice' | 'study';
}

interface MakeMoveDto {
  gameId: string;
  userId: string;
  from: string;
  to: string;
  promotion?: string;
}

interface ResignDto {
  gameId: string;
  userId: string;
}

export class GameService {
  async createGame({ userId, isBotGame, botLevel, mode = 'standard' }: CreateGameDto) {
    const user = await userRepo.findById(userId);
    if (!user) throw new AppError('User not found.', 404);

    const chess = new Chess();

    const game = await gameRepo.create({
      whitePlayerId: userId,
      blackPlayerId: isBotGame ? null : null,
      isBotGame,
      botLevel: isBotGame ? botLevel : null,
      mode,
      status: GameStatus.ACTIVE,
      fen: chess.fen(),
    });

    return game;
  }

  async getGameById(gameId: string) {
    const game = await gameRepo.findById(gameId);
    if (!game) throw new AppError('Game not found.', 404);
    return game;
  }

  async makeMove({ gameId, userId, from, to, promotion }: MakeMoveDto) {
    const game = await gameRepo.findById(gameId);
    if (!game) throw new AppError('Game not found.', 404);
    if (game.status !== GameStatus.ACTIVE) throw new AppError('Game is not active.', 400);

    // Validate the player's turn
    const chess = new Chess(game.fen);
    const turn = chess.turn(); // 'w' or 'b'

    const isWhite = game.whitePlayerId === userId;
    const isBlack = game.blackPlayerId === userId;

    if ((turn === 'w' && !isWhite) || (turn === 'b' && !isBlack)) {
      throw new AppError('Not your turn.', 400);
    }

    // Attempt the move
    let moveResult;
    try {
      moveResult = chess.move({
        from,
        to,
        promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
      });
    } catch {
      throw new AppError('Invalid move.', 400);
    }

    if (!moveResult) throw new AppError('Invalid move.', 400);

    // game.moves.length is the number of half-moves already stored.
    // After the player's move it becomes the (length+1)-th half-move.
    const moveNumber = game.moves.length + 1;
    const newFen = chess.fen();

    // Determine game status
    let newStatus: GameStatus = GameStatus.ACTIVE;
    let result: GameResult | null = null;

    if (chess.isCheckmate()) {
      newStatus = GameStatus.FINISHED;
      result = turn === 'w' ? GameResult.WHITE_WIN : GameResult.BLACK_WIN;
    } else if (chess.isDraw() || chess.isStalemate()) {
      newStatus = GameStatus.FINISHED;
      result = GameResult.DRAW;
    }

    // Persist move and updated game state
    await gameRepo.addMove({
      gameId,
      moveNumber,
      san: moveResult.san,
      uci: `${from}${to}${promotion ?? ''}`,
      color: turn,
    });

    const updatedGame = await gameRepo.updateFenAndStatus({
      gameId,
      fen: newFen,
      status: newStatus,
      result,
    });

    // If this is a bot game and the game is still active, make the bot's move
    if (game.isBotGame && newStatus === GameStatus.ACTIVE) {
      try {
        const botUci = await getBotMove(newFen, game.botLevel ?? 5);
        const botFrom = botUci.slice(0, 2);
        const botTo = botUci.slice(2, 4);
        const botPromotion = botUci.length > 4 ? botUci[4] : undefined;

        const botChess = new Chess(newFen);
        const botMoveResult = botChess.move({ from: botFrom, to: botTo, promotion: botPromotion as 'q' | 'r' | 'b' | 'n' | undefined });

        if (botMoveResult) {
          const botMoveNumber = game.moves.length + 2; // player's move + bot's move
          const botFen = botChess.fen();

          let botStatus: GameStatus = GameStatus.ACTIVE;
          let botResult: GameResult | null = null;
          if (botChess.isCheckmate()) {
            botStatus = GameStatus.FINISHED;
            botResult = GameResult.BLACK_WIN;
          } else if (botChess.isDraw() || botChess.isStalemate()) {
            botStatus = GameStatus.FINISHED;
            botResult = GameResult.DRAW;
          }

          await gameRepo.addMove({
            gameId,
            moveNumber: botMoveNumber,
            san: botMoveResult.san,
            uci: botUci,
            color: 'b',
          });

          const finalGame = await gameRepo.updateFenAndStatus({
            gameId,
            fen: botFen,
            status: botStatus,
            result: botResult,
          });

          // Apply ELO if the bot's move ended the game (not in practice mode)
          let ratingDelta: number | null = null;
          if (botStatus === GameStatus.FINISHED && game.whitePlayer && game.mode !== 'practice') {
            ratingDelta = await applyBotGameElo(
              userId, gameId, game.whitePlayer.rating, game.botLevel ?? 5, botResult!
            );
          }

          return {
            game: finalGame,
            move: {
              san: moveResult.san,
              uci: `${from}${to}${promotion ?? ''}`,
              fen: newFen,
            },
            botMove: {
              san: botMoveResult.san,
              uci: botUci,
              fen: botFen,
            },
            isGameOver: botStatus === GameStatus.FINISHED,
            result: botResult ? String(botResult) : null,
            ratingDelta,
          };
        }
      } catch (err) {
        // Bot move failed – log and return game state without bot move
        console.error('Bot move error:', err);
      }
    }

    // Apply ELO if the player's own move ended a bot game (not in practice mode)
    let eloChange: number | null = null;
    if (game.isBotGame && newStatus === GameStatus.FINISHED && game.whitePlayer && game.mode !== 'practice') {
      eloChange = await applyBotGameElo(
        userId, gameId, game.whitePlayer.rating, game.botLevel ?? 5, result!
      );
    }

    return {
      game: updatedGame,
      move: {
        san: moveResult.san,
        uci: `${from}${to}${promotion ?? ''}`,
        fen: newFen,
      },
      botMove: null,
      isGameOver: newStatus === GameStatus.FINISHED,
      result: result ? String(result) : null,
      ratingDelta: eloChange,
    };
  }

  async resign({ gameId, userId }: ResignDto) {
    const game = await gameRepo.findById(gameId);
    if (!game) throw new AppError('Game not found.', 404);
    if (game.status !== GameStatus.ACTIVE) throw new AppError('Game is not active.', 400);

    const isWhite = game.whitePlayerId === userId;
    const result = isWhite ? GameResult.BLACK_WIN : GameResult.WHITE_WIN;

    const updatedGame = await gameRepo.updateFenAndStatus({
      gameId,
      fen: game.fen,
      status: GameStatus.FINISHED,
      result,
    });

    // Apply ELO for resigning in a bot game (human is always white) — but not in practice mode
    let ratingDelta: number | null = null;
    if (game.isBotGame && game.whitePlayer && isWhite && game.mode !== 'practice') {
      ratingDelta = await applyBotGameElo(
        userId, gameId, game.whitePlayer.rating, game.botLevel ?? 5, result
      );
    }

    return { game: updatedGame, ratingDelta };
  }

  async undoMove({ gameId, userId }: { gameId: string; userId: string }) {
    const game = await gameRepo.findById(gameId);
    if (!game) throw new AppError('Game not found.', 404);
    if (game.status !== GameStatus.ACTIVE) throw new AppError('Game is not active.', 400);
    if (!game.isBotGame) throw new AppError('Undo is only available in bot games.', 400);
    if (game.mode !== 'practice' && game.mode !== 'study') throw new AppError('Undo is only available in practice or study mode.', 400);
    if (game.whitePlayerId !== userId) throw new AppError('Only the player can undo moves.', 403);
    if (game.moves.length === 0) throw new AppError('No moves to undo.', 400);

    // Determine how many moves to delete:
    // - Practice mode (PvE): delete 2 moves (player's move + bot's response)
    // - Study mode: delete 1 move
    const movesToDelete = game.mode === 'practice' ? 2 : 1;

    if (game.moves.length < movesToDelete) {
      throw new AppError(`Cannot undo: need at least ${movesToDelete} move(s).`, 400);
    }

    // Delete the moves
    await gameRepo.deleteLastMoves(gameId, movesToDelete);

    // Replay remaining moves to get the correct FEN
    const chess = new Chess();
    const remainingMoves = game.moves.slice(0, -movesToDelete);
    for (const move of remainingMoves) {
      chess.move({
        from: move.uci.slice(0, 2),
        to: move.uci.slice(2, 4),
        promotion: move.uci.length > 4 ? (move.uci[4] as 'q' | 'r' | 'b' | 'n') : undefined,
      });
    }

    const newFen = chess.fen();

    // Update game FEN
    const updatedGame = await gameRepo.updateFenAndStatus({
      gameId,
      fen: newFen,
      status: GameStatus.ACTIVE,
      result: null,
    });

    return updatedGame;
  }
}

