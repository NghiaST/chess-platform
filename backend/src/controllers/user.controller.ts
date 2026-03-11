import { Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { AuthenticatedRequest } from '../middlewares/authenticate';
import { AppError } from '../middlewares/errorHandler';

const userService = new UserService();

export class UserController {
  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const user = await userService.getUserById(req.user.id);
      res.json({ status: 'success', data: user });
    } catch (error) {
      next(error);
    }
  }

  async getUserById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getUserById(req.params.id);
      res.json({ status: 'success', data: user });
    } catch (error) {
      next(error);
    }
  }

  async getRatingHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const history = await userService.getRatingHistory(req.params.id);
      res.json({ status: 'success', data: history });
    } catch (error) {
      next(error);
    }
  }

  async getGameHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
      const data = await userService.getGameHistory(req.params.id, page, limit);
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }
}
