import { Chess } from 'chess.js';
import { GameStatus, GameResult } from '@prisma/client';
import { GameRepository } from '../repositories/game.repository';
import { UserRepository } from '../repositories/user.repository';
import { AppError } from '../middlewares/errorHandler';

const gameRepo = new GameRepository();
const userRepo = new UserRepository();

interface CreateGameDto {
  userId: string;
  isBotGame: boolean;
  botLevel: number;
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
  async createGame({ userId, isBotGame, botLevel }: CreateGameDto) {
    const user = await userRepo.findById(userId);
    if (!user) throw new AppError('User not found.', 404);

    const chess = new Chess();

    const game = await gameRepo.create({
      whitePlayerId: userId,
      blackPlayerId: isBotGame ? null : null,
      isBotGame,
      botLevel: isBotGame ? botLevel : null,
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

    const moveNumber = chess.history().length;
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

    return {
      game: updatedGame,
      move: {
        san: moveResult.san,
        uci: `${from}${to}${promotion ?? ''}`,
        fen: newFen,
      },
      isGameOver: newStatus === GameStatus.FINISHED,
      result: result ? String(result) : null,
    };
  }

  async resign({ gameId, userId }: ResignDto) {
    const game = await gameRepo.findById(gameId);
    if (!game) throw new AppError('Game not found.', 404);
    if (game.status !== GameStatus.ACTIVE) throw new AppError('Game is not active.', 400);

    const isWhite = game.whitePlayerId === userId;
    const result = isWhite ? GameResult.BLACK_WIN : GameResult.WHITE_WIN;

    return gameRepo.updateFenAndStatus({
      gameId,
      fen: game.fen,
      status: GameStatus.FINISHED,
      result,
    });
  }
}
