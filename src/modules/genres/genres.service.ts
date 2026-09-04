import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TmdbService } from '../tmdb/tmdb.service';

@Injectable()
export class GenresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdb: TmdbService,
  ) {}

  async findAll() {
    const dbGenres = await this.prisma.genre.findMany({ orderBy: { name: 'asc' } });
    if (dbGenres.length) return dbGenres;

    const result: any = await this.tmdb.genres();
    return result.genres.map((g: any) => ({ id: String(g.id), tmdbId: g.id, name: g.name }));
  }
}
