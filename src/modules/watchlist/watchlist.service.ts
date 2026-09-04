import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const items = await this.prisma.watchlist.findMany({
      where: { userId },
      include: { movie: { include: { genres: { include: { genre: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((i) => ({
      id: i.id,
      movie: {
        id: i.movie.id,
        title: i.movie.title,
        posterPath: i.movie.posterPath,
        rating: i.movie.rating,
        releaseDate: i.movie.releaseDate?.toISOString().split('T')[0],
      },
      createdAt: i.createdAt.toISOString(),
    }));
  }

  add(userId: string, movieId: string) {
    return this.prisma.watchlist.upsert({
      where: { userId_movieId: { userId, movieId } },
      update: {},
      create: { userId, movieId },
    });
  }

  remove(userId: string, movieId: string) {
    return this.prisma.watchlist.delete({
      where: { userId_movieId: { userId, movieId } },
    });
  }
}
