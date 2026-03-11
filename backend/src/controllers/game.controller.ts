import { Response, NextFunction } from 'express';
import { GameService } from '../services/game.service';
import { AuthenticatedRequest } from '../middlewares/authenticate';
import { AppError } from '../middlewares/errorHandler';

const gameService = new GameService();

export class GameController {
  async createGame(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const { isBotGame, botLevel, mode } = req.body;
      const game = await gameService.createGame({
        userId: req.user.id,
        isBotGame,
        botLevel: botLevel ?? 5,
        ...(mode ? { mode } : {}),
      });
      res.status(201).json({ status: 'success', data: game });
    } catch (error) {
      next(error);
    }
  }

  async getGame(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const game = await gameService.getGameById(req.params.id);
      res.json({ status: 'success', data: game });
    } catch (error) {
      next(error);
    }
  }

  async makeMove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const { from, to, promotion } = req.body;
      const result = await gameService.makeMove({
        gameId: req.params.id,
        userId: req.user.id,
        from,
        to,
        promotion,
      });
      res.json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  async resign(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const game = await gameService.resign({
        gameId: req.params.id,
        userId: req.user.id,
      });
      res.json({ status: 'success', data: game });
    } catch (error) {
      next(error);
    }
  }

  async undoMove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const game = await gameService.undoMove({
        gameId: req.params.id,
        userId: req.user.id,
      });
      res.json({ status: 'success', data: game });
    } catch (error) {
      next(error);
    }
  }
}
