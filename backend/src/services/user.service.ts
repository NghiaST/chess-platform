import { UserRepository } from '../repositories/user.repository';
import { GameRepository } from '../repositories/game.repository';
import { AppError } from '../middlewares/errorHandler';

const userRepo = new UserRepository();
const gameRepo = new GameRepository();

export class UserService {
  async getUserById(id: string) {
    const user = await userRepo.findById(id);
    if (!user) throw new AppError('User not found.', 404);

    const [wins, losses, draws] = await gameRepo.getUserGameStats(id);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      rating: user.rating,
      createdAt: user.createdAt,
      stats: { wins, losses, draws, total: wins + losses + draws },
    };
  }

  async getRatingHistory(userId: string) {
    const user = await userRepo.findById(userId);
    if (!user) throw new AppError('User not found.', 404);
    return userRepo.findRatingHistory(userId, 20);
  }

  async getGameHistory(userId: string, page: number, limit: number) {
    const user = await userRepo.findById(userId);
    if (!user) throw new AppError('User not found.', 404);

    const skip = (page - 1) * limit;
    const [games, total] = await Promise.all([
      gameRepo.getUserGameHistory(userId, skip, limit),
      gameRepo.countUserGameHistory(userId),
    ]);

    const enriched = games.map((game) => {
      const isWhite = game.whitePlayerId === userId;
      let result: 'win' | 'loss' | 'draw' | null = null;
      if (game.result === 'WHITE_WIN') result = isWhite ? 'win' : 'loss';
      else if (game.result === 'BLACK_WIN') result = isWhite ? 'loss' : 'win';
      else if (game.result === 'DRAW') result = 'draw';

      const opponent = game.isBotGame
        ? `Bot (Lv.${game.botLevel ?? '?'})`
        : isWhite
        ? (game.blackPlayer?.username ?? 'Unknown')
        : (game.whitePlayer?.username ?? 'Unknown');

      const rh = game.ratingHistory[0];
      return {
        id: game.id,
        date: game.updatedAt.toISOString(),
        opponent,
        color: isWhite ? 'white' as const : 'black' as const,
        result,
        ratingBefore: rh?.ratingBefore ?? null,
        ratingAfter: rh?.ratingAfter ?? null,
        ratingDelta: rh ? rh.ratingAfter - rh.ratingBefore : null,
        moveCount: game._count.moves,
      };
    });

    return {
      games: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
