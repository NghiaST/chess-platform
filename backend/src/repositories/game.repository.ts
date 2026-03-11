import { GameStatus, GameResult } from '@prisma/client';
import prisma from '../config/database';

interface RatingHistoryDto {
  userId: string;
  gameId: string;
  ratingBefore: number;
  ratingAfter: number;
}

interface CreateGameDto {
  whitePlayerId: string;
  blackPlayerId: string | null;
  isBotGame: boolean;
  botLevel: number | null;
  mode?: 'standard' | 'practice' | 'study';
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
      select: {
        id: true,
        whitePlayerId: true,
        blackPlayerId: true,
        isBotGame: true,
        botLevel: true,
        mode: true,
        status: true,
        result: true,
        fen: true,
        createdAt: true,
        updatedAt: true,
        moves: {
          select: { id: true, gameId: true, moveNumber: true, san: true, uci: true, color: true, createdAt: true },
          orderBy: { moveNumber: 'asc' },
        },
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
      select: {
        id: true,
        whitePlayerId: true,
        blackPlayerId: true,
        isBotGame: true,
        botLevel: true,
        mode: true,
        status: true,
        result: true,
        fen: true,
        createdAt: true,
        updatedAt: true,
        moves: {
          select: { id: true, gameId: true, moveNumber: true, san: true, uci: true, color: true, createdAt: true },
          orderBy: { moveNumber: 'asc' },
        },
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

  createRatingHistory({ userId, gameId, ratingBefore, ratingAfter }: RatingHistoryDto) {
    return prisma.ratingHistory.create({
      data: { userId, gameId, ratingBefore, ratingAfter },
    });
  }

  getUserGameHistory(userId: string, skip: number, take: number) {
    return prisma.game.findMany({
      where: {
        status: GameStatus.FINISHED,
        OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
      include: {
        whitePlayer: { select: { id: true, username: true } },
        blackPlayer: { select: { id: true, username: true } },
        ratingHistory: {
          where: { userId },
          select: { ratingBefore: true, ratingAfter: true },
        },
        _count: { select: { moves: true } },
      },
    });
  }

  countUserGameHistory(userId: string) {
    return prisma.game.count({
      where: {
        status: GameStatus.FINISHED,
        OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
      },
    });
  }

  getUserGameStats(userId: string): Promise<[number, number, number]> {
    return prisma.$transaction([
      prisma.game.count({
        where: {
          status: GameStatus.FINISHED,
          OR: [
            { whitePlayerId: userId, result: GameResult.WHITE_WIN },
            { blackPlayerId: userId, result: GameResult.BLACK_WIN },
          ],
        },
      }),
      prisma.game.count({
        where: {
          status: GameStatus.FINISHED,
          OR: [
            { whitePlayerId: userId, result: GameResult.BLACK_WIN },
            { blackPlayerId: userId, result: GameResult.WHITE_WIN },
          ],
        },
      }),
      prisma.game.count({
        where: {
          status: GameStatus.FINISHED,
          result: GameResult.DRAW,
          OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
        },
      }),
    ]) as Promise<[number, number, number]>;
  }

  async deleteLastMoves(gameId: string, count: number) {
    // Get the N moves with the highest moveNumbers for this game
    const movesToDelete = await prisma.move.findMany({
      where: { gameId },
      orderBy: { moveNumber: 'desc' },
      take: count,
      select: { id: true },
    });

    if (movesToDelete.length === 0) return null;

    // Delete those moves
    return prisma.move.deleteMany({
      where: {
        id: { in: movesToDelete.map((m) => m.id) },
      },
    });
  }
}
