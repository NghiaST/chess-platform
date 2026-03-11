import { Request, Response, NextFunction } from 'express';
import { LeaderboardService } from '../services/leaderboard.service';

const leaderboardService = new LeaderboardService();

export class LeaderboardController {
  async getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const data = await leaderboardService.getLeaderboard({ page, limit });
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }
}
