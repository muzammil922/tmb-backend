import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(page = 1, search = '') {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const skip = (page - 1) * 20;
    return Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]).then(([data, total]) => ({
      data,
      page,
      totalPages: Math.ceil(total / 20) || 1,
      totalResults: total,
    }));
  }

  async update(id: string, data: Partial<{ role: UserRole; status: UserStatus }>) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException();
    return this.prisma.user.update({ where: { id }, data });
  }

  async getHistory(id: string) {
    return this.prisma.watchHistory.findMany({
      where: { userId: id },
      include: { movie: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  remove(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}
