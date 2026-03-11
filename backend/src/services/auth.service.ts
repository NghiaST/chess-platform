import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository';
import { AppError } from '../middlewares/errorHandler';

const userRepo = new UserRepository();

interface RegisterDto {
  username: string;
  email: string;
  password: string;
}

interface LoginDto {
  email: string;
  password: string;
}

export class AuthService {
  async register({ username, email, password }: RegisterDto) {
    // Check for existing user
    const existing = await userRepo.findByEmail(email);
    if (existing) throw new AppError('Email already in use.', 409);

    const existingUsername = await userRepo.findByUsername(username);
    if (existingUsername) throw new AppError('Username already taken.', 409);

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await userRepo.create({
      username,
      email,
      passwordHash,
      rating: 1200, // Default ELO rating
    });

    const token = this.signToken(user.id, user.email, user.username);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        rating: user.rating,
        createdAt: user.createdAt,
      },
    };
  }

  async login({ email, password }: LoginDto) {
    const user = await userRepo.findByEmail(email);
    if (!user) throw new AppError('Invalid email or password.', 401);

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) throw new AppError('Invalid email or password.', 401);

    const token = this.signToken(user.id, user.email, user.username);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        rating: user.rating,
        createdAt: user.createdAt,
      },
    };
  }

  private signToken(id: string, email: string, username: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');

    return jwt.sign({ id, email, username }, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    } as jwt.SignOptions);
  }
}
