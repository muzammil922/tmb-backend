import { Injectable } from '@nestjs/common';
import { TmdbService } from '../tmdb/tmdb.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MovieStatus } from '@prisma/client';

@Injectable()
export class SearchService {
  constructor(
    private readonly tmdb: TmdbService,
    private readonly prisma: PrismaService,
  ) {}

  async search(query: string, page = 1) {
    const dbMovies = await this.prisma.movie.findMany({
      where: {
        status: MovieStatus.ACTIVE,
        title: { contains: query, mode: 'insensitive' },
      },
      take: 10,
    });

    const tmdbResult: any = await this.tmdb.search(query, page);
    const tmdbMovies = (tmdbResult.results ?? [])
      .filter((r: any) => r.media_type === 'movie' || r.title)
      .map((m: any) => ({
        id: String(m.id),
        tmdbId: m.id,
        title: m.title || m.name,
        posterPath: m.poster_path,
        rating: m.vote_average,
        mediaType: m.media_type || 'movie',
      }));

    const dbMapped = dbMovies.map((m) => ({
      id: m.id,
      tmdbId: m.tmdbId,
      title: m.title,
      posterPath: m.posterPath,
      rating: m.rating,
      mediaType: 'movie',
    }));

    const merged = [...dbMapped, ...tmdbMovies.filter((t: any) => !dbMapped.some((d) => d.tmdbId === t.tmdbId))];
    return { data: merged, page, totalResults: merged.length };
  }
}
