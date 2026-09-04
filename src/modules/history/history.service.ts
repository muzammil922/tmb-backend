import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const items = await this.prisma.watchHistory.findMany({
      where: { userId },
      include: { movie: true },
      orderBy: { updatedAt: 'desc' },
    });
    return items.map((i) => ({
      id: i.id,
      progress: i.progress,
      movie: {
        id: i.movie.id,
        title: i.movie.title,
        posterPath: i.movie.posterPath,
        backdropPath: i.movie.backdropPath,
        videoUrl: i.movie.videoUrl,
        videoDuration: i.movie.videoDuration,
      },
      watchedAt: i.watchedAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    }));
  }

  async upsert(userId: string, movieId: string, progress: number) {
    return this.prisma.watchHistory.upsert({
      where: { userId_movieId: { userId, movieId } },
      update: { progress, watchedAt: new Date() },
      create: { userId, movieId, progress },
    });
  }

  continueWatching(userId: string) {
    return this.prisma.watchHistory.findMany({
      where: { userId, progress: { gt: 0, lt: 95 } },
      include: { movie: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
  }
}
