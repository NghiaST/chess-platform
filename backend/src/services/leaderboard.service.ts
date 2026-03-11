import { LeaderboardRepository } from '../repositories/leaderboard.repository';

const leaderboardRepo = new LeaderboardRepository();

interface PaginationDto {
  page: number;
  limit: number;
}

export class LeaderboardService {
  async getLeaderboard({ page, limit }: PaginationDto) {
    const skip = (page - 1) * limit;
    const [players, total] = await leaderboardRepo.getTopPlayers({ skip, take: limit });

    return {
      players,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
