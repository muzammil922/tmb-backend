import { Injectable, NotFoundException } from '@nestjs/common';
import { Movie, MovieStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TmdbService } from '../tmdb/tmdb.service';
import { CacheService } from '../../common/cache/cache.service';
import { ContentSyncService } from '../sync/content-sync.service';

type MovieWithRelations = Movie & {
  genres?: { genre: { id: string; tmdbId: number | null; name: string } }[];
  cast?: { id: string; name: string; character: string | null; profilePath: string | null; order: number }[];
};

@Injectable()
export class MoviesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdb: TmdbService,
    private readonly cache: CacheService,
    private readonly contentSync: ContentSyncService,
  ) {}

  private mapMovie(movie: MovieWithRelations) {
    return {
      id: movie.id,
      tmdbId: movie.tmdbId,
      title: movie.title,
      originalTitle: movie.originalTitle,
      overview: movie.overview,
      posterPath: movie.posterPath,
      backdropPath: movie.backdropPath,
      releaseDate: movie.releaseDate?.toISOString().split('T')[0] ?? null,
      runtime: movie.runtime,
      rating: movie.rating,
      voteCount: movie.voteCount,
      language: movie.language,
      status: movie.status,
      source: movie.source,
      featured: movie.featured,
      videoUrl: movie.videoUrl,
      videoProvider: movie.videoProvider,
      videoDuration: movie.videoDuration,
      trailerKey: movie.trailerKey,
      genres: movie.genres?.map((g) => g.genre) ?? [],
      cast: movie.cast?.sort((a, b) => a.order - b.order).map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profilePath: c.profilePath,
      })),
      playback: this.contentSync.buildPlaybackBlock(movie),
    };
  }

  private movieInclude = {
    genres: { include: { genre: true } },
    cast: true,
  } satisfies Prisma.MovieInclude;

  async listFromDb(where: Prisma.MovieWhereInput, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.movie.findMany({
        where: { status: MovieStatus.ACTIVE, ...where },
        include: this.movieInclude,
        orderBy: { rating: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.movie.count({ where: { status: MovieStatus.ACTIVE, ...where } }),
    ]);
    return {
      data: data.map((m) => this.mapMovie(m)),
      page,
      totalPages: Math.ceil(total / limit) || 1,
      totalResults: total,
    };
  }

  async listFromTmdb(type: string, page = 1) {
    const cacheKey = `movies:${type}:${page}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    let result: any;
    switch (type) {
      case 'trending':
        result = await this.tmdb.trending(page);
        break;
      case 'popular':
        result = await this.tmdb.popular(page);
        break;
      case 'top-rated':
        result = await this.tmdb.topRated(page);
        break;
      case 'upcoming':
        result = await this.tmdb.upcoming(page);
        break;
      case 'now-playing':
        result = await this.tmdb.nowPlaying(page);
        break;
      default:
        result = await this.tmdb.popular(page);
    }

    const mapped = {
      data: result.results.map((m: any) => ({
        id: String(m.id),
        tmdbId: m.id,
        title: m.title,
        overview: m.overview,
        posterPath: m.poster_path,
        backdropPath: m.backdrop_path,
        releaseDate: m.release_date,
        rating: m.vote_average,
        voteCount: m.vote_count,
        language: m.original_language,
        status: 'ACTIVE',
        source: 'TMDB',
        featured: false,
      })),
      page: result.page,
      totalPages: result.total_pages,
      totalResults: result.total_results,
    };

    const ttl = type === 'trending' ? 3600 : 21600;
    await this.cache.set(cacheKey, mapped, ttl);
    return mapped;
  }

  async getList(type: string, page = 1) {
    const dbCount = await this.prisma.movie.count({ where: { status: MovieStatus.ACTIVE } });
    if (dbCount >= 5) {
      const orderMap: Record<string, Prisma.MovieOrderByWithRelationInput> = {
        trending: { updatedAt: 'desc' },
        popular: { voteCount: 'desc' },
        'top-rated': { rating: 'desc' },
        upcoming: { releaseDate: 'asc' },
        'now-playing': { releaseDate: 'desc' },
      };
      return this.listFromDb({}, page, 20);
    }
    return this.listFromTmdb(type, page);
  }

  async findOne(id: string) {
    const movie = await this.prisma.movie.findUnique({
      where: { id },
      include: this.movieInclude,
    });
    if (movie) return this.mapMovie(movie);

    const tmdbId = Number(id);
    if (!Number.isNaN(tmdbId)) {
      const details: any = await this.tmdb.movieDetails(tmdbId);
      return {
        id: String(details.id),
        tmdbId: details.id,
        title: details.title,
        originalTitle: details.original_title,
        overview: details.overview,
        posterPath: details.poster_path,
        backdropPath: details.backdrop_path,
        releaseDate: details.release_date,
        runtime: details.runtime,
        rating: details.vote_average,
        voteCount: details.vote_count,
        language: details.original_language,
        status: 'ACTIVE',
        source: 'TMDB',
        featured: false,
        videoUrl: null,
        genres: details.genres?.map((g: any) => ({ id: String(g.id), tmdbId: g.id, name: g.name })) ?? [],
        cast: details.credits?.cast?.slice(0, 12).map((c: any) => ({
          id: String(c.id),
          name: c.name,
          character: c.character,
          profilePath: c.profile_path,
        })) ?? [],
        trailerKey: details.videos?.results?.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer')?.key ?? null,
      };
    }
    throw new NotFoundException('Movie not found');
  }

  async getCast(id: string) {
    const movie = await this.findOne(id);
    return movie.cast ?? [];
  }

  async getVideos(id: string) {
    const tmdbId = Number(id);
    if (!Number.isNaN(tmdbId)) {
      const videos: any = await this.tmdb.movieVideos(tmdbId);
      return videos.results ?? [];
    }
    const movie = await this.prisma.movie.findUnique({ where: { id } });
    if (movie?.trailerKey) {
      return [{ key: movie.trailerKey, site: 'YouTube', type: 'Trailer' }];
    }
    return [];
  }

  async getSimilar(id: string, page = 1) {
    const tmdbId = Number(id);
    if (!Number.isNaN(tmdbId)) {
      const result: any = await this.tmdb.similar(tmdbId, page);
      return {
        data: result.results.map((m: any) => ({
          id: String(m.id),
          tmdbId: m.id,
          title: m.title,
          posterPath: m.poster_path,
          rating: m.vote_average,
        })),
        page: result.page,
        totalPages: result.total_pages,
        totalResults: result.total_results,
      };
    }
    return { data: [], page: 1, totalPages: 1, totalResults: 0 };
  }

  async getRecommendations(id: string, page = 1) {
    const tmdbId = Number(id);
    if (!Number.isNaN(tmdbId)) {
      const result: any = await this.tmdb.recommendations(tmdbId, page);
      return {
        data: result.results.map((m: any) => ({
          id: String(m.id),
          tmdbId: m.id,
          title: m.title,
          posterPath: m.poster_path,
          rating: m.vote_average,
        })),
        page: result.page,
        totalPages: result.total_pages,
        totalResults: result.total_results,
      };
    }
    return { data: [], page: 1, totalPages: 1, totalResults: 0 };
  }

  async byGenre(genreId: string, page = 1) {
    const genre = await this.prisma.genre.findFirst({
      where: { OR: [{ id: genreId }, { tmdbId: Number(genreId) || undefined }] },
    });

    if (genre) {
      const skip = (page - 1) * 20;
      const movies = await this.prisma.movie.findMany({
        where: { status: MovieStatus.ACTIVE, genres: { some: { genreId: genre.id } } },
        include: this.movieInclude,
        skip,
        take: 20,
      });
      return { data: movies.map((m) => this.mapMovie(m)), page, totalPages: 1, totalResults: movies.length };
    }

    const result: any = await this.tmdb.discoverByGenre(Number(genreId), page);
    return {
      data: result.results.map((m: any) => ({
        id: String(m.id),
        tmdbId: m.id,
        title: m.title,
        posterPath: m.poster_path,
        rating: m.vote_average,
      })),
      page: result.page,
      totalPages: result.total_pages,
      totalResults: result.total_results,
    };
  }
}
