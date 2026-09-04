import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [totalUsers, totalMovies, activeUsers, totalWatchHistory] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.movie.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.watchHistory.count(),
    ]);

    const recentUsers = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    const popularMovies = await this.prisma.movie.findMany({
      orderBy: { rating: 'desc' },
      take: 5,
      select: { id: true, title: true, rating: true, posterPath: true },
    });

    return {
      totalUsers,
      totalMovies,
      activeUsers,
      totalWatchHistory,
      recentUsers,
      popularMovies,
    };
  }
}
