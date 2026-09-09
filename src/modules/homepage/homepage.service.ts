import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MoviesService } from '../movies/movies.service';
import { TmdbService } from '../tmdb/tmdb.service';

@Injectable()
export class HomepageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movies: MoviesService,
    private readonly tmdb: TmdbService,
  ) {}

  async getHomepage() {
    const sections = await this.prisma.homepageSection.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        movies: {
          orderBy: { order: 'asc' },
          include: {
            movie: {
              include: { genres: { include: { genre: true } }, cast: true },
            },
          },
        },
      },
    });

    const resolved = await Promise.all(
      sections.map(async (section) => {
        if (section.mode === 'MANUAL' && section.movies.length) {
          return {
            id: section.id,
            title: section.title,
            type: section.type,
            order: section.order,
            isActive: section.isActive,
            mode: section.mode,
            movies: section.movies.map((sm) => ({
              id: sm.movie.id,
              tmdbId: sm.movie.tmdbId,
              title: sm.movie.title,
              posterPath: sm.movie.posterPath,
              backdropPath: sm.movie.backdropPath,
              rating: sm.movie.rating,
              overview: sm.movie.overview,
              featured: sm.movie.featured,
            })),
          };
        }

        let movies: any[] = [];
        if (section.type === 'genre' && section.config && typeof section.config === 'object' && 'genreId' in section.config) {
          const result = await this.movies.byGenre(String((section.config as any).genreId));
          movies = (result as { data: any[] }).data;
        } else {
          const result = await this.movies.getList(section.type === 'top-rated' ? 'top-rated' : section.type);
          movies = (result as { data: any[] }).data;
        }

        return {
          id: section.id,
          title: section.title,
          type: section.type,
          order: section.order,
          isActive: section.isActive,
          mode: section.mode,
          movies,
        };
      }),
    );

    const featured = await this.prisma.movie.findFirst({
      where: { featured: true, status: 'ACTIVE' },
    });

    let hero = featured
      ? {
          id: featured.id,
          title: featured.title,
          overview: featured.overview,
          backdropPath: featured.backdropPath,
          posterPath: featured.posterPath,
          rating: featured.rating,
        }
      : null;

    if (!hero) {
      const trending: any = await this.tmdb.trending();
      const first = trending.results?.[0];
      if (first) {
        hero = {
          id: String(first.id),
          title: first.title,
          overview: first.overview,
          backdropPath: first.backdrop_path,
          posterPath: first.poster_path,
          rating: first.vote_average,
        };
      }
    }

    const banners = await this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return { hero, banners, sections: resolved };
  }
}
