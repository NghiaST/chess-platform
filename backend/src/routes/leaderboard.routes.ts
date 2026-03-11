import { Router } from 'express';
import { LeaderboardController } from '../controllers/leaderboard.controller';
import { query } from 'express-validator';
import { validate } from '../middlewares/validate';

const router = Router();
const leaderboardController = new LeaderboardController();

// GET /api/leaderboard?page=1&limit=10
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be >= 1'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be 1-100'),
  ],
  validate,
  leaderboardController.getLeaderboard
);

export default router;
