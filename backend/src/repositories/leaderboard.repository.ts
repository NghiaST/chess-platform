import prisma from '../config/database';

interface GetTopPlayersDto {
  skip: number;
  take: number;
}

export class LeaderboardRepository {
  async getTopPlayers({ skip, take }: GetTopPlayersDto): Promise<[unknown[], number]> {
    const [players, total] = await prisma.$transaction([
      prisma.user.findMany({
        orderBy: { rating: 'desc' },
        skip,
        take,
        select: {
          id: true,
          username: true,
          rating: true,
          createdAt: true,
          _count: {
            select: { gamesAsWhite: true, gamesAsBlack: true },
          },
        },
      }),
      prisma.user.count(),
    ]);

    return [players, total];
  }
}
