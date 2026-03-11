import prisma from '../config/database';

interface CreateUserDto {
  username: string;
  email: string;
  passwordHash: string;
  rating: number;
}

export class UserRepository {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  findByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  }

  create(data: CreateUserDto) {
    return prisma.user.create({ data });
  }

  updateRating(id: string, rating: number) {
    return prisma.user.update({ where: { id }, data: { rating } });
  }
}
