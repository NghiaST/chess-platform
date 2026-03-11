import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
}
