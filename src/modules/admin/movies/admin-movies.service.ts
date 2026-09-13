import { Injectable, NotFoundException } from '@nestjs/common';
import { MovieSource, MovieStatus, PlaybackStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { TmdbService } from '../../tmdb/tmdb.service';
import { autoCategorizeMovie } from '../categories/category-helper';

@Injectable()
export class AdminMoviesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdb: TmdbService,
  ) {}

  async list(
    page = 1,
    search = '',
    limit = 50,
    playbackStatus?: string,
  ) {
    const where: Prisma.MovieWhereInput = {};

    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    if (playbackStatus && playbackStatus !== 'all') {
      if (playbackStatus === 'not-working') {
        where.playbackStatus = { not: PlaybackStatus.WORKING };
      } else if (playbackStatus in PlaybackStatus) {
        where.playbackStatus = playbackStatus as PlaybackStatus;
      }
    }

    const skip = (page - 1) * limit;
    const [data, total, workingCount, brokenCount, pendingCount, notWorkingCount] = await Promise.all([
      this.prisma.movie.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          categoryMovies: {
            include: {
              category: true,
            },
          },
          genres: {
            include: {
              genre: true,
            },
          },
        },
      }),
      this.prisma.movie.count({ where }),
      this.prisma.movie.count({ where: { playbackStatus: PlaybackStatus.WORKING } }),
      this.prisma.movie.count({ where: { playbackStatus: PlaybackStatus.BROKEN } }),
      this.prisma.movie.count({ where: { playbackStatus: PlaybackStatus.PENDING } }),
      this.prisma.movie.count({
        where: { playbackStatus: { not: PlaybackStatus.WORKING } },
      }),
    ]);
    return {
      data,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      totalResults: total,
      stats: { workingCount, brokenCount, pendingCount, notWorkingCount },
    };
  }

  async findOne(id: string) {
    const movie = await this.prisma.movie.findUnique({
      where: { id },
      include: {
        categoryMovies: {
          include: {
            category: true,
          },
        },
        genres: {
          include: {
            genre: true,
          },
        },
        cast: {
          orderBy: { order: 'asc' },
          take: 20,
        },
      },
    });
    if (!movie) throw new NotFoundException('Movie not found');
    return movie;
  }

  async createManual(data: {
    title: string;
    overview?: string;
    posterPath?: string;
    backdropPath?: string;
    releaseDate?: string;
    runtime?: number;
    rating?: number;
    language?: string;
    status?: MovieStatus;
    featured?: boolean;
    trailerKey?: string;
    genreIds?: string[];
  }) {
    const movie = await this.prisma.movie.create({
      data: {
        title: data.title,
        overview: data.overview,
        posterPath: data.posterPath,
        backdropPath: data.backdropPath,
        releaseDate: data.releaseDate ? new Date(data.releaseDate) : undefined,
        runtime: data.runtime,
        rating: data.rating,
        language: data.language,
        status: data.status ?? MovieStatus.DRAFT,
        featured: data.featured ?? false,
        trailerKey: data.trailerKey,
        source: MovieSource.MANUAL,
      },
    });
    if (data.genreIds?.length) {
      await this.prisma.movieGenre.createMany({
        data: data.genreIds.map((genreId) => ({ movieId: movie.id, genreId })),
        skipDuplicates: true,
      });
    }
    await autoCategorizeMovie(this.prisma, movie.id);
    return movie;
  }

  async update(id: string, data: Partial<{
    title: string;
    overview: string;
    posterPath: string;
    backdropPath: string;
    releaseDate: string;
    runtime: number;
    rating: number;
    language: string;
    status: MovieStatus;
    featured: boolean;
    trailerKey: string;
    videoUrl: string;
    videoProvider: string;
    videoDuration: number;
  }>) {
    const movie = await this.prisma.movie.findUnique({ where: { id } });
    if (!movie) throw new NotFoundException('Movie not found');
    return this.prisma.movie.update({
      where: { id },
      data: {
        ...data,
        releaseDate: data.releaseDate ? new Date(data.releaseDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.movie.delete({ where: { id } });
  }

  async searchTmdb(query: string) {
    const result: any = await this.tmdb.searchMovies(query);
    return result.results ?? [];
  }

  async importFromTmdb(tmdbId: number) {
    const details: any = await this.tmdb.movieDetails(tmdbId);

    const trailer = details.videos?.results?.find(
      (v: any) => v.site === 'YouTube' && v.type === 'Trailer',
    );

    const movie = await this.prisma.movie.upsert({
      where: { tmdbId },
      update: {
        title: details.title,
        originalTitle: details.original_title,
        overview: details.overview,
        posterPath: details.poster_path,
        backdropPath: details.backdrop_path,
        releaseDate: details.release_date ? new Date(details.release_date) : null,
        runtime: details.runtime,
        rating: details.vote_average,
        voteCount: details.vote_count,
        language: details.original_language,
        trailerKey: trailer?.key,
        status: MovieStatus.ACTIVE,
        source: MovieSource.TMDB,
      },
      create: {
        tmdbId,
        title: details.title,
        originalTitle: details.original_title,
        overview: details.overview,
        posterPath: details.poster_path,
        backdropPath: details.backdrop_path,
        releaseDate: details.release_date ? new Date(details.release_date) : null,
        runtime: details.runtime,
        rating: details.vote_average,
        voteCount: details.vote_count,
        language: details.original_language,
        trailerKey: trailer?.key,
        status: MovieStatus.ACTIVE,
        source: MovieSource.TMDB,
      },
    });

    if (details.genres?.length) {
      for (const g of details.genres) {
        const genre = await this.prisma.genre.upsert({
          where: { tmdbId: g.id },
          update: { name: g.name },
          create: { tmdbId: g.id, name: g.name },
        });
        await this.prisma.movieGenre.upsert({
          where: { movieId_genreId: { movieId: movie.id, genreId: genre.id } },
          update: {},
          create: { movieId: movie.id, genreId: genre.id },
        });
      }
    }

    if (details.credits?.cast?.length) {
      await this.prisma.movieCast.deleteMany({ where: { movieId: movie.id } });
      await this.prisma.movieCast.createMany({
        data: details.credits.cast.slice(0, 20).map((c: any, index: number) => ({
          movieId: movie.id,
          tmdbPersonId: c.id,
          name: c.name,
          character: c.character,
          profilePath: c.profile_path,
          order: index,
        })),
      });
    }

    await autoCategorizeMovie(this.prisma, movie.id);

    return movie;
  }

  attachVideo(id: string, videoUrl: string, videoProvider: string, videoDuration?: number) {
    return this.prisma.movie.update({
      where: { id },
      data: { videoUrl, videoProvider, videoDuration, status: MovieStatus.ACTIVE },
    });
  }
}
