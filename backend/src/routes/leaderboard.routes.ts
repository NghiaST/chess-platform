import { Router } from 'express';
import { LeaderboardController } from '../controllers/leaderboard.controller';
import { query } from 'express-validator';
import { validate } from '../middlewares/validate';

const router = Router();
const leaderboardController = new LeaderboardController();

/**
 * @swagger
 * tags:
 *   name: Leaderboard
 *   description: Top players ranking
 */

/**
 * @swagger
 * /api/leaderboard:
 *   get:
 *     summary: Get leaderboard (top players by rating)
 *     tags: [Leaderboard]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: List of top players
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 */
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
