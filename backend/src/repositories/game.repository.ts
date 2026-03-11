import { GameStatus, GameResult } from '@prisma/client';
import prisma from '../config/database';

interface CreateGameDto {
  whitePlayerId: string;
  blackPlayerId: string | null;
  isBotGame: boolean;
  botLevel: number | null;
  status: GameStatus;
  fen: string;
}

interface AddMoveDto {
  gameId: string;
  moveNumber: number;
  san: string;
  uci: string;
  color: string;
}

interface UpdateGameDto {
  gameId: string;
  fen: string;
  status: GameStatus;
  result: GameResult | null;
}

export class GameRepository {
  findById(id: string) {
    return prisma.game.findUnique({
      where: { id },
      include: {
        moves: { orderBy: { moveNumber: 'asc' } },
        whitePlayer: { select: { id: true, username: true, rating: true } },
        blackPlayer: { select: { id: true, username: true, rating: true } },
      },
    });
  }

  create(data: CreateGameDto) {
    return prisma.game.create({ data });
  }

  addMove({ gameId, moveNumber, san, uci, color }: AddMoveDto) {
    return prisma.move.create({
      data: { gameId, moveNumber, san, uci, color },
    });
  }

  updateFenAndStatus({ gameId, fen, status, result }: UpdateGameDto) {
    return prisma.game.update({
      where: { id: gameId },
      data: { fen, status, result },
      include: {
        moves: { orderBy: { moveNumber: 'asc' } },
      },
    });
  }

  findUserGames(userId: string) {
    return prisma.game.findMany({
      where: {
        OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        whitePlayer: { select: { id: true, username: true, rating: true } },
        blackPlayer: { select: { id: true, username: true, rating: true } },
      },
    });
  }
}
