import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const items = await this.prisma.favorite.findMany({
      where: { userId },
      include: { movie: true },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((i) => ({
      id: i.id,
      movie: {
        id: i.movie.id,
        title: i.movie.title,
        posterPath: i.movie.posterPath,
        rating: i.movie.rating,
      },
      createdAt: i.createdAt.toISOString(),
    }));
  }

  add(userId: string, movieId: string) {
    return this.prisma.favorite.upsert({
      where: { userId_movieId: { userId, movieId } },
      update: {},
      create: { userId, movieId },
    });
  }

  remove(userId: string, movieId: string) {
    return this.prisma.favorite.delete({
      where: { userId_movieId: { userId, movieId } },
    });
  }
}
