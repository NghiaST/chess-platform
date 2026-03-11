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
}
