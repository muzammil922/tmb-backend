import { Injectable } from '@nestjs/common';
import { ContentType, PlaybackStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [
      totalUsers,
      totalMovies,
      totalSeries,
      totalAnime,
      workingCount,
      brokenCount,
      pendingCount,
      activeUsers,
      totalWatchHistory,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.movie.count(),
      this.prisma.series.count({ where: { contentType: ContentType.SERIES } }),
      this.prisma.series.count({ where: { contentType: ContentType.ANIME } }),
      this.prisma.movie.count({ where: { playbackStatus: PlaybackStatus.WORKING } }).then((m) =>
        this.prisma.series.count({ where: { playbackStatus: PlaybackStatus.WORKING } }).then((s) => m + s),
      ),
      this.prisma.movie.count({ where: { playbackStatus: PlaybackStatus.BROKEN } }).then((m) =>
        this.prisma.series.count({ where: { playbackStatus: PlaybackStatus.BROKEN } }).then((s) => m + s),
      ),
      this.prisma.movie.count({ where: { playbackStatus: PlaybackStatus.PENDING } }).then((m) =>
        this.prisma.series.count({ where: { playbackStatus: PlaybackStatus.PENDING } }).then((s) => m + s),
      ),
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
      totalSeries,
      totalAnime,
      workingCount,
      brokenCount,
      pendingCount,
      activeUsers,
      totalWatchHistory,
      recentUsers,
      popularMovies,
    };
  }
}
