import { Router } from 'express';
import { GameController } from '../controllers/game.controller';
import { authenticate } from '../middlewares/authenticate';
import { body, param } from 'express-validator';
import { validate } from '../middlewares/validate';

const router = Router();
const gameController = new GameController();

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

// GET /api/games/:id — protected
router.get(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid game ID')],
  validate,
  gameController.getGame
);

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

// POST /api/games/:id/resign — protected
router.post(
  '/:id/resign',
  authenticate,
  [param('id').isUUID().withMessage('Invalid game ID')],
  validate,
  gameController.resign
);

export default router;
