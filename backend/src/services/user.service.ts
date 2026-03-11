import { UserRepository } from '../repositories/user.repository';
import { AppError } from '../middlewares/errorHandler';

const userRepo = new UserRepository();

export class UserService {
  async getUserById(id: string) {
    const user = await userRepo.findById(id);
    if (!user) throw new AppError('User not found.', 404);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      rating: user.rating,
      createdAt: user.createdAt,
    };
  }
}
