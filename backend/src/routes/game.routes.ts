import { Router } from 'express';
import { GameController } from '../controllers/game.controller';
import { authenticate } from '../middlewares/authenticate';
import { body, param } from 'express-validator';
import { validate } from '../middlewares/validate';

const router = Router();
const gameController = new GameController();

/**
 * @swagger
 * tags:
 *   name: Games
 *   description: Chess game management
 */

/**
 * @swagger
 * /api/games/create:
 *   post:
 *     summary: Create a new game
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isBotGame]
 *             properties:
 *               isBotGame:
 *                 type: boolean
 *                 example: true
 *               botLevel:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 20
 *                 example: 5
 *     responses:
 *       201:
 *         description: Game created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Game'
 *       401:
 *         description: Unauthorized
 */
// POST /api/games/create — protected
router.post(
  '/create',
  authenticate,
  [
    body('isBotGame').isBoolean().withMessage('isBotGame must be a boolean'),
    body('botLevel')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('botLevel must be 1-20'),
  ],
  validate,
  gameController.createGame
);

/**
 * @swagger
 * /api/games/{id}:
 *   get:
 *     summary: Get game by ID
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Game data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Game'
 *       404:
 *         description: Game not found
 */
// GET /api/games/:id — protected
router.get(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid game ID')],
  validate,
  gameController.getGame
);

/**
 * @swagger
 * /api/games/{id}/move:
 *   post:
 *     summary: Make a move in a game
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [from, to]
 *             properties:
 *               from:
 *                 type: string
 *                 example: e2
 *               to:
 *                 type: string
 *                 example: e4
 *               promotion:
 *                 type: string
 *                 enum: [q, r, b, n]
 *     responses:
 *       200:
 *         description: Move applied
 *       400:
 *         description: Invalid move
 *       401:
 *         description: Unauthorized
 */
// POST /api/games/:id/move — protected
router.post(
  '/:id/move',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid game ID'),
    body('from').isLength({ min: 2, max: 2 }).withMessage('Invalid from square'),
    body('to').isLength({ min: 2, max: 2 }).withMessage('Invalid to square'),
    body('promotion')
      .optional()
      .isIn(['q', 'r', 'b', 'n'])
      .withMessage('Invalid promotion piece'),
  ],
  validate,
  gameController.makeMove
);

/**
 * @swagger
 * /api/games/{id}/resign:
 *   post:
 *     summary: Resign from a game
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Resigned successfully
 *       401:
 *         description: Unauthorized
 */
// POST /api/games/:id/resign — protected
router.post(
  '/:id/resign',
  authenticate,
  [param('id').isUUID().withMessage('Invalid game ID')],
  validate,
  gameController.resign
);

export default router;
