import { Injectable, Logger } from '@nestjs/common';
import {
  ContentSource,
  ContentType,
  MovieSource,
  MovieStatus,
  PlaybackMode,
  Prisma,
  SyncStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TmdbService } from '../tmdb/tmdb.service';
import { UrduboxClient } from './clients/urdubox.client';
import { MoviesApiClient } from './clients/movies-api.client';

export type SyncAction = 'IMPORT' | 'SKIP';

export interface SyncDecision {
  action: SyncAction;
  reason: string;
  message: string;
  existingId?: string;
  existingTitle?: string;
  existingSource?: ContentSource | null;
}

@Injectable()
export class ContentSyncService {
  private readonly logger = new Logger(ContentSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdb: TmdbService,
    private readonly urdubox: UrduboxClient,
    private readonly moviesApi: MoviesApiClient,
  ) {}

  async checkContent(tmdbId: number, contentType: ContentType = ContentType.MOVIE): Promise<SyncDecision> {
    return this.shouldImport(tmdbId, contentType);
  }

  async shouldImport(tmdbId: number, contentType: ContentType): Promise<SyncDecision> {
    if (contentType === ContentType.MOVIE) {
      const existing = await this.prisma.movie.findUnique({ where: { tmdbId } });
      if (existing) {
        return {
          action: 'SKIP',
          reason: 'already_exists',
          message: `Pehle se hai: "${existing.title}" (source: ${existing.contentSource ?? 'unknown'})`,
          existingId: existing.id,
          existingTitle: existing.title,
          existingSource: existing.contentSource,
        };
      }
    } else {
      const existing = await this.prisma.series.findUnique({ where: { tmdbId } });
      if (existing) {
        return {
          action: 'SKIP',
          reason: 'already_exists',
          message: `Pehle se hai: "${existing.title}" (source: ${existing.contentSource ?? 'unknown'})`,
          existingId: existing.id,
          existingTitle: existing.title,
          existingSource: existing.contentSource,
        };
      }
    }

    return {
      action: 'IMPORT',
      reason: 'new',
      message: 'Naya content — import ho sakta hai',
    };
  }

  async checkUrduboxAvailability(tmdbId: number, contentType: ContentType) {
    if (!this.urdubox.isEnabled()) {
      return { available: false, upstreamId: null as string | null };
    }

    const response =
      contentType === ContentType.MOVIE
        ? await this.urdubox.findMovieByTmdbId(tmdbId)
        : await this.urdubox.findSeriesByTmdbId(tmdbId);

    const items = this.urdubox.extractItems(response);
    const match = items.find((item) => this.urdubox.resolveTmdbId(item) === tmdbId) ?? items[0];

    if (!match) {
      return { available: false, upstreamId: null as string | null };
    }

    return {
      available: true,
      upstreamId: this.urdubox.resolveUpstreamId(match),
    };
  }

  async importMovieFromUrdubox(
    tmdbId: number,
    upstreamId?: string | null,
    jobId?: string,
  ) {
    const decision = await this.shouldImport(tmdbId, ContentType.MOVIE);
    if (decision.action === 'SKIP') {
      if (jobId) await this.logEntry(jobId, tmdbId, null, decision.existingTitle, 'SKIPPED', decision.reason, ContentType.MOVIE);
      return { ...decision, imported: false };
    }

    try {
      const details: any = await this.tmdb.movieDetails(tmdbId);
      const resolvedUpstreamId = upstreamId ?? (await this.checkUrduboxAvailability(tmdbId, ContentType.MOVIE)).upstreamId;

      const trailer = details.videos?.results?.find(
        (v: any) => v.site === 'YouTube' && v.type === 'Trailer',
      );

      const movie = await this.prisma.movie.create({
        data: {
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
          contentSource: ContentSource.URDBOX,
          playbackMode: PlaybackMode.URDBOX,
          upstreamId: resolvedUpstreamId,
          upstreamSyncedAt: new Date(),
        },
      });

      await this.syncMovieRelations(movie.id, details);

      if (jobId) {
        await this.logEntry(jobId, tmdbId, resolvedUpstreamId, movie.title, 'IMPORTED', 'new', ContentType.MOVIE);
      }

      return {
        action: 'IMPORT' as SyncAction,
        reason: 'new',
        message: 'Urdubox se import ho gaya',
        imported: true,
        movie,
      };
    } catch (error) {
      this.logger.error(`Urdubox import failed for tmdbId ${tmdbId}`, error);
      if (jobId) await this.logEntry(jobId, tmdbId, upstreamId ?? null, null, 'FAILED', 'import_error', ContentType.MOVIE);
      throw error;
    }
  }

  async importSeriesFromUrdubox(
    tmdbId: number,
    upstreamId?: string | null,
    jobId?: string,
  ) {
    const decision = await this.shouldImport(tmdbId, ContentType.SERIES);
    if (decision.action === 'SKIP') {
      if (jobId) await this.logEntry(jobId, tmdbId, null, decision.existingTitle, 'SKIPPED', decision.reason, ContentType.SERIES);
      return { ...decision, imported: false };
    }

    try {
      const details: any = await this.tmdb.tvDetails(tmdbId);
      const resolvedUpstreamId = upstreamId ?? (await this.checkUrduboxAvailability(tmdbId, ContentType.SERIES)).upstreamId;

      const series = await this.prisma.series.create({
        data: {
          tmdbId,
          title: details.name,
          originalTitle: details.original_name,
          overview: details.overview,
          posterPath: details.poster_path,
          backdropPath: details.backdrop_path,
          firstAirDate: details.first_air_date ? new Date(details.first_air_date) : null,
          lastAirDate: details.last_air_date ? new Date(details.last_air_date) : null,
          numberOfSeasons: details.number_of_seasons,
          numberOfEpisodes: details.number_of_episodes,
          rating: details.vote_average,
          voteCount: details.vote_count,
          language: details.original_language,
          status: MovieStatus.ACTIVE,
          contentSource: ContentSource.URDBOX,
          playbackMode: PlaybackMode.URDBOX,
          upstreamId: resolvedUpstreamId,
          upstreamSyncedAt: new Date(),
        },
      });

      if (jobId) {
        await this.logEntry(jobId, tmdbId, resolvedUpstreamId, series.title, 'IMPORTED', 'new', ContentType.SERIES);
      }

      return {
        action: 'IMPORT' as SyncAction,
        reason: 'new',
        message: 'Urdubox se series import ho gayi',
        imported: true,
        series,
      };
    } catch (error) {
      this.logger.error(`Urdubox series import failed for tmdbId ${tmdbId}`, error);
      if (jobId) await this.logEntry(jobId, tmdbId, upstreamId ?? null, null, 'FAILED', 'import_error', ContentType.SERIES);
      throw error;
    }
  }

  async importMovieFromMoviesApi(tmdbId: number, jobId?: string) {
    const decision = await this.shouldImport(tmdbId, ContentType.MOVIE);
    if (decision.action === 'SKIP') {
      if (jobId) await this.logEntry(jobId, tmdbId, null, decision.existingTitle, 'SKIPPED', decision.reason, ContentType.MOVIE);
      return { ...decision, imported: false };
    }

    try {
      const details: any = await this.tmdb.movieDetails(tmdbId);
      const trailer = details.videos?.results?.find(
        (v: any) => v.site === 'YouTube' && v.type === 'Trailer',
      );

      const movie = await this.prisma.movie.create({
        data: {
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
          contentSource: ContentSource.MOVIESAPI,
          playbackMode: PlaybackMode.EMBED,
          upstreamSyncedAt: new Date(),
        },
      });

      await this.syncMovieRelations(movie.id, details);

      if (jobId) {
        await this.logEntry(jobId, tmdbId, null, movie.title, 'IMPORTED', 'new', ContentType.MOVIE);
      }

      return {
        action: 'IMPORT' as SyncAction,
        reason: 'new',
        message: 'MoviesAPI embed se import ho gaya',
        imported: true,
        movie,
      };
    } catch (error) {
      this.logger.error(`MoviesAPI import failed for tmdbId ${tmdbId}`, error);
      if (jobId) await this.logEntry(jobId, tmdbId, null, null, 'FAILED', 'import_error', ContentType.MOVIE);
      throw error;
    }
  }

  async importSeriesFromMoviesApi(tmdbId: number, jobId?: string) {
    const decision = await this.shouldImport(tmdbId, ContentType.SERIES);
    if (decision.action === 'SKIP') {
      if (jobId) await this.logEntry(jobId, tmdbId, null, decision.existingTitle, 'SKIPPED', decision.reason, ContentType.SERIES);
      return { ...decision, imported: false };
    }

    try {
      const details: any = await this.tmdb.tvDetails(tmdbId);

      const series = await this.prisma.series.create({
        data: {
          tmdbId,
          title: details.name,
          originalTitle: details.original_name,
          overview: details.overview,
          posterPath: details.poster_path,
          backdropPath: details.backdrop_path,
          firstAirDate: details.first_air_date ? new Date(details.first_air_date) : null,
          lastAirDate: details.last_air_date ? new Date(details.last_air_date) : null,
          numberOfSeasons: details.number_of_seasons,
          numberOfEpisodes: details.number_of_episodes,
          rating: details.vote_average,
          voteCount: details.vote_count,
          language: details.original_language,
          status: MovieStatus.ACTIVE,
          contentSource: ContentSource.MOVIESAPI,
          playbackMode: PlaybackMode.EMBED,
          upstreamSyncedAt: new Date(),
        },
      });

      if (jobId) {
        await this.logEntry(jobId, tmdbId, null, series.title, 'IMPORTED', 'new', ContentType.SERIES);
      }

      return {
        action: 'IMPORT' as SyncAction,
        reason: 'new',
        message: 'MoviesAPI embed se series import ho gayi',
        imported: true,
        series,
      };
    } catch (error) {
      this.logger.error(`MoviesAPI series import failed for tmdbId ${tmdbId}`, error);
      if (jobId) await this.logEntry(jobId, tmdbId, null, null, 'FAILED', 'import_error', ContentType.SERIES);
      throw error;
    }
  }

  async publishOwnEmbed(movieId: string) {
    const movie = await this.prisma.movie.findUnique({ where: { id: movieId } });
    if (!movie?.tmdbId) {
      throw new Error('Movie tmdbId required for embed mode');
    }

    return this.prisma.movie.update({
      where: { id: movieId },
      data: {
        contentSource: ContentSource.MOVIESAPI,
        playbackMode: PlaybackMode.EMBED,
        status: MovieStatus.ACTIVE,
        upstreamSyncedAt: new Date(),
      },
    });
  }

  async publishOwnHosted(movieId: string, videoUrl: string, videoProvider: string, videoDuration?: number) {
    return this.prisma.movie.update({
      where: { id: movieId },
      data: {
        videoUrl,
        videoProvider,
        videoDuration,
        contentSource: ContentSource.HOSTED,
        playbackMode: PlaybackMode.HOSTED,
        status: MovieStatus.ACTIVE,
        upstreamSyncedAt: new Date(),
      },
    });
  }

  private async syncMovieRelations(movieId: string, details: any) {
    if (details.genres?.length) {
      for (const g of details.genres) {
        const genre = await this.prisma.genre.upsert({
          where: { tmdbId: g.id },
          update: { name: g.name },
          create: { tmdbId: g.id, name: g.name },
        });
        await this.prisma.movieGenre.upsert({
          where: { movieId_genreId: { movieId, genreId: genre.id } },
          update: {},
          create: { movieId, genreId: genre.id },
        });
      }
    }

    if (details.credits?.cast?.length) {
      await this.prisma.movieCast.deleteMany({ where: { movieId } });
      await this.prisma.movieCast.createMany({
        data: details.credits.cast.slice(0, 20).map((c: any, index: number) => ({
          movieId,
          tmdbPersonId: c.id,
          name: c.name,
          character: c.character,
          profilePath: c.profile_path,
          order: index,
        })),
      });
    }
  }

  private async logEntry(
    jobId: string,
    tmdbId: number | null,
    upstreamId: string | null | undefined,
    title: string | null | undefined,
    action: string,
    reason: string | null,
    contentType: ContentType,
  ) {
    await this.prisma.syncLog.create({
      data: {
        jobId,
        tmdbId: tmdbId ?? undefined,
        upstreamId: upstreamId ?? undefined,
        title: title ?? undefined,
        action,
        reason: reason ?? undefined,
        contentType,
      },
    });
  }

  buildPlaybackBlock(movie: {
    id: string;
    tmdbId: number | null;
    playbackMode: PlaybackMode | null;
    contentSource: ContentSource | null;
    videoUrl: string | null;
  }) {
    if (movie.playbackMode === PlaybackMode.HOSTED && movie.videoUrl) {
      return {
        mode: PlaybackMode.HOSTED,
        available: true,
        source: ContentSource.HOSTED,
        playerUrl: movie.videoUrl,
      };
    }

    if (movie.playbackMode === PlaybackMode.EMBED && movie.tmdbId) {
      return {
        mode: PlaybackMode.EMBED,
        available: true,
        source: ContentSource.MOVIESAPI,
        playerUrl: this.moviesApi.buildMovieEmbedPath(movie.tmdbId),
      };
    }

    if (movie.playbackMode === PlaybackMode.URDBOX && movie.tmdbId) {
      return {
        mode: PlaybackMode.URDBOX,
        available: true,
        source: ContentSource.URDBOX,
        playerUrl: `/api/stream/movie/${movie.tmdbId}/playlist.m3u8`,
        hlsUrl: `/api/stream/movie/${movie.tmdbId}/playlist.m3u8`,
      };
    }

    return {
      mode: null,
      available: false,
      source: movie.contentSource,
      playerUrl: null,
    };
  }

  buildSeriesPlaybackBlock(
    series: {
      tmdbId: number | null;
      playbackMode: PlaybackMode | null;
      contentSource: ContentSource | null;
    },
    season: number,
    episode: number,
  ) {
    if (series.playbackMode === PlaybackMode.EMBED && series.tmdbId) {
      return {
        mode: PlaybackMode.EMBED,
        available: true,
        source: ContentSource.MOVIESAPI,
        playerUrl: this.moviesApi.buildTvEmbedPath(series.tmdbId, season, episode),
      };
    }

    if (series.playbackMode === PlaybackMode.URDBOX && series.tmdbId) {
      const path = `/api/stream/tv/${series.tmdbId}/${season}/${episode}/playlist.m3u8`;
      return {
        mode: PlaybackMode.URDBOX,
        available: true,
        source: ContentSource.URDBOX,
        playerUrl: path,
        hlsUrl: path,
      };
    }

    return {
      mode: null,
      available: false,
      source: series.contentSource,
      playerUrl: null,
    };
  }
}
