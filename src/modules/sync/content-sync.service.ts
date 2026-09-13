import { Injectable, Logger } from '@nestjs/common';
import {
  ContentSource,
  ContentType,
  MovieSource,
  MovieStatus,
  PlaybackMode,
  PlaybackStatus,
  Prisma,
  SyncStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TmdbService } from '../tmdb/tmdb.service';
import { MoviesApiClient } from './clients/movies-api.client';
import { Imdb3Client } from './clients/imdb3.client';
import { PlaybackVerifierService } from './playback-verifier.service';
import { isAnimeContent } from './helpers/anime.helper';
import { SyncPresetId } from './sync-presets';
import { autoCategorizeMovie, autoCategorizeSeries } from '../admin/categories/category-helper';

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
    private readonly moviesApi: MoviesApiClient,
    private readonly imdb3: Imdb3Client,
    private readonly playbackVerifier: PlaybackVerifierService,
  ) {}

  async purgeUrduBoxContent() {
    const [movies, series] = await Promise.all([
      this.prisma.movie.deleteMany({
        where: {
          OR: [{ contentSource: ContentSource.URDBOX }, { playbackMode: PlaybackMode.URDBOX }],
        },
      }),
      this.prisma.series.deleteMany({
        where: {
          OR: [{ contentSource: ContentSource.URDBOX }, { playbackMode: PlaybackMode.URDBOX }],
        },
      }),
    ]);
    return { moviesDeleted: movies.count, seriesDeleted: series.count };
  }

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

  async importMovieFromMoviesApi(
    tmdbId: number,
    jobId?: string,
    options: { syncPreset?: SyncPresetId; skipBroken?: boolean } = {},
  ) {
    return this.importMovieFromPreset(tmdbId, options.syncPreset ?? 'trending', jobId, options);
  }

  async importSeriesFromMoviesApi(
    tmdbId: number,
    jobId?: string,
    options: { syncPreset?: SyncPresetId; skipBroken?: boolean } = {},
  ) {
    return this.importSeriesFromPreset(tmdbId, options.syncPreset ?? 'trending', jobId, options);
  }

  async importMovieFromPreset(
    tmdbId: number,
    syncPreset: SyncPresetId,
    jobId?: string,
    options: { skipBroken?: boolean } = {},
  ) {
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

      const isAnime = isAnimeContent({
        original_language: details.original_language,
        origin_country: details.origin_country,
        genres: details.genres,
      });

      const playbackStatus = await this.playbackVerifier.verify({
        contentType: isAnime ? ContentType.ANIME : ContentType.MOVIE,
        tmdbId,
        title: details.title,
        language: details.original_language,
        genres: details.genres,
        playbackMode: PlaybackMode.EMBED,
      });

      if (options.skipBroken !== false && playbackStatus === PlaybackStatus.BROKEN) {
        if (jobId) await this.logEntry(jobId, tmdbId, null, details.title, 'SKIPPED', 'playback_broken', ContentType.MOVIE);
        return { action: 'SKIP' as SyncAction, reason: 'playback_broken', message: 'Playback unavailable', imported: false };
      }

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
          playbackStatus,
          playbackCheckedAt: new Date(),
          syncPreset,
          upstreamSyncedAt: new Date(),
        },
      });

      await this.syncMovieRelations(movie.id, details);
      await autoCategorizeMovie(this.prisma, movie.id);

      if (jobId) {
        await this.logEntry(jobId, tmdbId, null, movie.title, 'IMPORTED', syncPreset, ContentType.MOVIE);
      }

      return {
        action: 'IMPORT' as SyncAction,
        reason: 'new',
        message: 'Movie import ho gayi',
        imported: true,
        playbackStatus,
        movie,
      };
    } catch (error) {
      this.logger.error(`Movie import failed for tmdbId ${tmdbId}`, error);
      if (jobId) await this.logEntry(jobId, tmdbId, null, null, 'FAILED', 'import_error', ContentType.MOVIE);
      throw error;
    }
  }

  async importSeriesFromPreset(
    tmdbId: number,
    syncPreset: SyncPresetId,
    jobId?: string,
    options: { skipBroken?: boolean } = {},
  ) {
    const decision = await this.shouldImport(tmdbId, ContentType.SERIES);
    if (decision.action === 'SKIP') {
      if (jobId) await this.logEntry(jobId, tmdbId, null, decision.existingTitle, 'SKIPPED', decision.reason, ContentType.SERIES);
      return { ...decision, imported: false };
    }

    try {
      const details: any = await this.tmdb.tvDetails(tmdbId);
      const isAnime =
        syncPreset === 'anime' ||
        isAnimeContent({
          original_language: details.original_language,
          origin_country: details.origin_country,
          genres: details.genres,
        });

      const playbackStatus = await this.playbackVerifier.verify({
        contentType: isAnime ? ContentType.ANIME : ContentType.SERIES,
        tmdbId,
        title: details.name,
        language: details.original_language,
        genres: details.genres,
        playbackMode: PlaybackMode.EMBED,
      });

      if (options.skipBroken !== false && playbackStatus === PlaybackStatus.BROKEN) {
        if (jobId) await this.logEntry(jobId, tmdbId, null, details.name, 'SKIPPED', 'playback_broken', ContentType.SERIES);
        return { action: 'SKIP' as SyncAction, reason: 'playback_broken', message: 'Playback unavailable', imported: false };
      }

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
          contentType: isAnime ? ContentType.ANIME : ContentType.SERIES,
          contentSource: ContentSource.MOVIESAPI,
          playbackMode: PlaybackMode.EMBED,
          playbackStatus,
          playbackCheckedAt: new Date(),
          syncPreset,
          upstreamSyncedAt: new Date(),
        },
      });

      await this.syncSeriesRelations(series.id, details);
      await this.syncTmdbSeriesEpisodes(series.id, tmdbId, details);
      await autoCategorizeSeries(this.prisma, series.id);

      if (jobId) {
        await this.logEntry(jobId, tmdbId, null, series.title, 'IMPORTED', syncPreset, isAnime ? ContentType.ANIME : ContentType.SERIES);
      }

      return {
        action: 'IMPORT' as SyncAction,
        reason: 'new',
        message: 'Series import ho gayi',
        imported: true,
        playbackStatus,
        series,
      };
    } catch (error) {
      this.logger.error(`Series import failed for tmdbId ${tmdbId}`, error);
      if (jobId) await this.logEntry(jobId, tmdbId, null, null, 'FAILED', 'import_error', ContentType.SERIES);
      throw error;
    }
  }

  async recheckMoviePlayback(movieId: string) {
    const movie = await this.prisma.movie.findUnique({
      where: { id: movieId },
      include: { genres: { include: { genre: true } } },
    });
    if (!movie) return null;

    const playbackStatus = await this.playbackVerifier.verify({
      contentType: ContentType.MOVIE,
      tmdbId: movie.tmdbId,
      title: movie.title,
      language: movie.language,
      genres: movie.genres.map((g) => ({ id: g.genre.tmdbId ?? 0 })),
      playbackMode: movie.playbackMode,
      videoUrl: movie.videoUrl,
    });

    return this.prisma.movie.update({
      where: { id: movieId },
      data: { playbackStatus, playbackCheckedAt: new Date() },
    });
  }

  async recheckSeriesPlayback(seriesId: string) {
    const series = await this.prisma.series.findUnique({
      where: { id: seriesId },
      include: { genres: { include: { genre: true } } },
    });
    if (!series) return null;

    const playbackStatus = await this.playbackVerifier.verify({
      contentType: series.contentType,
      tmdbId: series.tmdbId,
      title: series.title,
      language: series.language,
      genres: series.genres.map((g) => ({ id: g.genre.tmdbId ?? 0 })),
      playbackMode: series.playbackMode,
    });

    return this.prisma.series.update({
      where: { id: seriesId },
      data: { playbackStatus, playbackCheckedAt: new Date() },
    });
  }

  async repairMovie(movieId: string, jobId?: string) {
    const movie = await this.prisma.movie.findUnique({
      where: { id: movieId },
      include: { genres: { include: { genre: true } } },
    });
    if (!movie) {
      return { fixed: false, playbackStatus: PlaybackStatus.BROKEN, reason: 'not_found' };
    }

    if (movie.playbackStatus === PlaybackStatus.WORKING) {
      return { fixed: false, playbackStatus: PlaybackStatus.WORKING, reason: 'already_working' };
    }

    if (movie.playbackMode === PlaybackMode.HOSTED && movie.videoUrl) {
      const hostedStatus = await this.playbackVerifier.verify({
        contentType: ContentType.MOVIE,
        tmdbId: movie.tmdbId,
        title: movie.title,
        playbackMode: movie.playbackMode,
        videoUrl: movie.videoUrl,
      });
      if (hostedStatus === PlaybackStatus.WORKING) {
        await this.prisma.movie.update({
          where: { id: movieId },
          data: { playbackStatus: hostedStatus, playbackCheckedAt: new Date() },
        });
        if (jobId) {
          await this.logEntry(jobId, movie.tmdbId, movie.upstreamId, movie.title, 'REPAIRED', 'hosted_ok', ContentType.MOVIE);
        }
        return { fixed: true, playbackStatus: hostedStatus, reason: 'hosted_ok', tmdbId: movie.tmdbId };
      }
    }

    let tmdbId = movie.tmdbId;
    if (!tmdbId) {
      tmdbId = await this.resolveMovieTmdbId(movie.title, movie.releaseDate);
      if (!tmdbId) {
        await this.prisma.movie.update({
          where: { id: movieId },
          data: { playbackStatus: PlaybackStatus.BROKEN, playbackCheckedAt: new Date() },
        });
        if (jobId) {
          await this.logEntry(jobId, null, movie.upstreamId, movie.title, 'SKIPPED', 'no_tmdb_match', ContentType.MOVIE);
        }
        return { fixed: false, playbackStatus: PlaybackStatus.BROKEN, reason: 'no_tmdb_match' };
      }

      const duplicate = await this.prisma.movie.findFirst({
        where: { tmdbId, id: { not: movieId } },
      });
      if (duplicate) {
        if (jobId) {
          await this.logEntry(jobId, tmdbId, null, movie.title, 'SKIPPED', 'duplicate_tmdb', ContentType.MOVIE);
        }
        return { fixed: false, playbackStatus: PlaybackStatus.BROKEN, reason: 'duplicate_tmdb', tmdbId };
      }
    }

    try {
      const details: any = await this.tmdb.movieDetails(tmdbId);
      const playbackStatus = await this.playbackVerifier.verify({
        contentType: ContentType.MOVIE,
        tmdbId,
        title: details.title,
        language: details.original_language,
        genres: details.genres,
        playbackMode: PlaybackMode.EMBED,
      });

      const trailer = details.videos?.results?.find(
        (v: any) => v.site === 'YouTube' && v.type === 'Trailer',
      );

      const updated = await this.prisma.movie.update({
        where: { id: movieId },
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
          contentSource: playbackStatus === PlaybackStatus.WORKING ? ContentSource.MOVIESAPI : movie.contentSource,
          playbackMode: PlaybackMode.EMBED,
          playbackStatus,
          playbackCheckedAt: new Date(),
          upstreamSyncedAt: new Date(),
        },
      });

      await this.syncMovieRelations(movieId, details);

      const reason = playbackStatus === PlaybackStatus.WORKING ? 'embed_ok' : 'embed_broken';
      if (jobId) {
        await this.logEntry(
          jobId,
          tmdbId,
          null,
          updated.title,
          playbackStatus === PlaybackStatus.WORKING ? 'REPAIRED' : 'SKIPPED',
          reason,
          ContentType.MOVIE,
        );
      }

      return {
        fixed: playbackStatus === PlaybackStatus.WORKING,
        playbackStatus,
        reason,
        tmdbId,
      };
    } catch (error) {
      this.logger.error(`Repair movie failed for ${movieId}`, error);
      if (jobId) {
        await this.logEntry(jobId, tmdbId, null, movie.title, 'FAILED', 'repair_error', ContentType.MOVIE);
      }
      throw error;
    }
  }

  async repairSeries(seriesId: string, jobId?: string) {
    const series = await this.prisma.series.findUnique({
      where: { id: seriesId },
      include: { genres: { include: { genre: true } } },
    });
    if (!series) {
      return { fixed: false, playbackStatus: PlaybackStatus.BROKEN, reason: 'not_found' };
    }

    if (series.playbackStatus === PlaybackStatus.WORKING) {
      return { fixed: false, playbackStatus: PlaybackStatus.WORKING, reason: 'already_working' };
    }

    let tmdbId = series.tmdbId;
    if (!tmdbId) {
      tmdbId = await this.resolveSeriesTmdbId(series.title, series.firstAirDate);
      if (!tmdbId) {
        await this.prisma.series.update({
          where: { id: seriesId },
          data: { playbackStatus: PlaybackStatus.BROKEN, playbackCheckedAt: new Date() },
        });
        if (jobId) {
          await this.logEntry(jobId, null, series.upstreamId, series.title, 'SKIPPED', 'no_tmdb_match', series.contentType);
        }
        return { fixed: false, playbackStatus: PlaybackStatus.BROKEN, reason: 'no_tmdb_match' };
      }

      const duplicate = await this.prisma.series.findFirst({
        where: { tmdbId, id: { not: seriesId } },
      });
      if (duplicate) {
        if (jobId) {
          await this.logEntry(jobId, tmdbId, null, series.title, 'SKIPPED', 'duplicate_tmdb', series.contentType);
        }
        return { fixed: false, playbackStatus: PlaybackStatus.BROKEN, reason: 'duplicate_tmdb', tmdbId };
      }
    }

    try {
      const details: any = await this.tmdb.tvDetails(tmdbId);
      const isAnime =
        series.contentType === ContentType.ANIME ||
        isAnimeContent({
          original_language: details.original_language,
          origin_country: details.origin_country,
          genres: details.genres,
          contentType: series.contentType,
        });

      const playbackStatus = await this.playbackVerifier.verify({
        contentType: isAnime ? ContentType.ANIME : ContentType.SERIES,
        tmdbId,
        title: details.name,
        language: details.original_language,
        genres: details.genres,
        playbackMode: PlaybackMode.EMBED,
      });

      const updated = await this.prisma.series.update({
        where: { id: seriesId },
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
          contentType: isAnime ? ContentType.ANIME : ContentType.SERIES,
          contentSource: playbackStatus === PlaybackStatus.WORKING ? ContentSource.MOVIESAPI : series.contentSource,
          playbackMode: PlaybackMode.EMBED,
          playbackStatus,
          playbackCheckedAt: new Date(),
          upstreamSyncedAt: new Date(),
        },
      });

      await this.syncSeriesRelations(seriesId, details);
      if (playbackStatus === PlaybackStatus.WORKING) {
        await this.syncTmdbSeriesEpisodes(seriesId, tmdbId, details);
      }
      await autoCategorizeSeries(this.prisma, seriesId);

      const reason = playbackStatus === PlaybackStatus.WORKING ? 'embed_ok' : 'embed_broken';
      if (jobId) {
        await this.logEntry(
          jobId,
          tmdbId,
          null,
          updated.title,
          playbackStatus === PlaybackStatus.WORKING ? 'REPAIRED' : 'SKIPPED',
          reason,
          isAnime ? ContentType.ANIME : ContentType.SERIES,
        );
      }

      return {
        fixed: playbackStatus === PlaybackStatus.WORKING,
        playbackStatus,
        reason,
        tmdbId,
      };
    } catch (error) {
      this.logger.error(`Repair series failed for ${seriesId}`, error);
      if (jobId) {
        await this.logEntry(jobId, tmdbId, null, series.title, 'FAILED', 'repair_error', series.contentType);
      }
      throw error;
    }
  }

  private async resolveMovieTmdbId(title: string, releaseDate?: Date | null): Promise<number | null> {
    const query = title.trim();
    if (!query) return null;

    const res: any = await this.tmdb.searchMovies(query, 1);
    const results = res.results ?? [];
    if (!results.length) return null;

    const year = releaseDate?.getFullYear();
    if (year) {
      for (const item of results.slice(0, 5)) {
        if (!item.release_date) continue;
        const itemYear = new Date(item.release_date).getFullYear();
        if (Math.abs(itemYear - year) <= 1 && this.titlesClose(query, item.title)) {
          return item.id;
        }
      }
    }

    const first = results[0];
    return this.titlesClose(query, first.title) ? first.id : null;
  }

  private async resolveSeriesTmdbId(title: string, firstAirDate?: Date | null): Promise<number | null> {
    const query = title.trim();
    if (!query) return null;

    const res: any = await this.tmdb.searchTv(query, 1);
    const results = res.results ?? [];
    if (!results.length) return null;

    const year = firstAirDate?.getFullYear();
    if (year) {
      for (const item of results.slice(0, 5)) {
        if (!item.first_air_date) continue;
        const itemYear = new Date(item.first_air_date).getFullYear();
        if (Math.abs(itemYear - year) <= 1 && this.titlesClose(query, item.name)) {
          return item.id;
        }
      }
    }

    const first = results[0];
    return this.titlesClose(query, first.name) ? first.id : null;
  }

  private titlesClose(a: string, b: string): boolean {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const na = norm(a);
    const nb = norm(b);
    if (!na || !nb) return false;
    return na === nb || na.includes(nb) || nb.includes(na);
  }

  async importMovieFromImdb3(id: number | string, jobId?: string) {
    const upstreamId = String(id).trim();

    // Check if already imported
    const existing = await this.prisma.movie.findFirst({
      where: {
        upstreamId,
        contentSource: ContentSource.IMDB3,
      },
    });

    if (existing) {
      if (jobId) {
        await this.logEntry(jobId, null, upstreamId, existing.title, 'SKIPPED', 'already_exists', ContentType.MOVIE);
      }
      return {
        action: 'SKIP' as SyncAction,
        reason: 'already_exists',
        message: `Movie "${existing.title}" pehle se mojood hai`,
        imported: false,
        movie: existing,
      };
    }

    try {
      const item = await this.imdb3.getMovieById(upstreamId);
      if (!item || !item.title) {
        if (jobId) {
          await this.logEntry(jobId, null, upstreamId, null, 'FAILED', 'not_found_on_upstream', ContentType.MOVIE);
        }
        return {
          action: 'SKIP' as SyncAction,
          reason: 'not_found',
          message: `Movie ID ${upstreamId} IMDB3 par nahi mili`,
          imported: false,
        };
      }

      const titleClean = item.title.trim().replace(/\n/g, '');

      // Check title duplicate
      const duplicateTitle = await this.prisma.movie.findFirst({
        where: { title: { equals: titleClean, mode: 'insensitive' } },
      });
      if (duplicateTitle) {
        if (jobId) {
          await this.logEntry(jobId, null, upstreamId, titleClean, 'SKIPPED', 'already_exists', ContentType.MOVIE);
        }
        return {
          action: 'SKIP' as SyncAction,
          reason: 'already_exists',
          message: `Movie "${titleClean}" pehle se mojood hai`,
          imported: false,
          movie: duplicateTitle,
        };
      }

      // Resolve stream URL
      let streamUrl: string | null = null;
      if (item.subjectid) {
        streamUrl = await this.imdb3.resolveStreamUrl(item.subjectid);
      }

      let releaseDate: Date | null = null;
      if (item.release_date) {
        const parsed = new Date(item.release_date);
        if (!isNaN(parsed.getTime())) releaseDate = parsed;
      }

      const voteAvg = item.vote_average ? parseFloat(item.vote_average) : null;
      const durationSec = item.duration ? parseInt(item.duration, 10) : 0;
      const runtimeMinutes = durationSec > 0 ? Math.round(durationSec / 60) : null;
      const overviewClean = item.dis ? item.dis.replace(/^["']|["']$/g, '').trim() : '';

      const movie = await this.prisma.movie.create({
        data: {
          title: titleClean,
          overview: overviewClean || null,
          posterPath: item.backdrop_path || null,
          backdropPath: item.backdrop_path || null,
          releaseDate,
          runtime: runtimeMinutes,
          rating: voteAvg,
          language: item.country?.toLowerCase().includes('india') ? 'hi' : 'en',
          videoUrl: streamUrl,
          videoProvider: 'IMDB3_MOVIEBOX',
          videoDuration: runtimeMinutes ? runtimeMinutes * 60 : null,
          trailerKey: item.trailer || null,
          status: MovieStatus.ACTIVE,
          source: MovieSource.MANUAL,
          contentSource: ContentSource.IMDB3,
          playbackMode: PlaybackMode.HOSTED,
          upstreamId,
          upstreamSyncedAt: new Date(),
        },
      });

      // Populate cast members if stafflist is available
      if (Array.isArray(item.stafflist) && item.stafflist.length > 0) {
        for (let i = 0; i < Math.min(item.stafflist.length, 10); i++) {
          const staff = item.stafflist[i];
          if (staff.name) {
            await this.prisma.movieCast.create({
              data: {
                movieId: movie.id,
                name: staff.name,
                character: staff.character || null,
                profilePath: staff.avatarUrl || null,
                order: i,
              },
            });
          }
        }
      }

      // Auto-categorize movie into platform categories
      await autoCategorizeMovie(this.prisma, movie.id);

      if (jobId) {
        await this.logEntry(jobId, null, upstreamId, movie.title, 'IMPORTED', 'new', ContentType.MOVIE);
      }

      return {
        action: 'IMPORT' as SyncAction,
        reason: 'new',
        message: `Movie "${movie.title}" IMDB3 se import ho gayi`,
        imported: true,
        movie,
      };
    } catch (error: any) {
      this.logger.error(`IMDB3 import failed for ID ${upstreamId}: ${error?.message || error}`);
      if (jobId) {
        await this.logEntry(jobId, null, upstreamId, null, 'FAILED', error?.message || 'import_error', ContentType.MOVIE);
      }
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

    await autoCategorizeMovie(this.prisma, movieId);
  }

  private async syncSeriesRelations(seriesId: string, details: any) {
    if (details.genres?.length) {
      for (const g of details.genres) {
        const genre = await this.prisma.genre.upsert({
          where: { tmdbId: g.id },
          update: { name: g.name },
          create: { tmdbId: g.id, name: g.name },
        });
        await this.prisma.seriesGenre.upsert({
          where: { seriesId_genreId: { seriesId, genreId: genre.id } },
          update: {},
          create: { seriesId, genreId: genre.id },
        });
      }
    }

    if (details.credits?.cast?.length) {
      await this.prisma.seriesCast.deleteMany({ where: { seriesId } });
      await this.prisma.seriesCast.createMany({
        data: details.credits.cast.slice(0, 20).map((c: any, index: number) => ({
          seriesId,
          tmdbPersonId: c.id,
          name: c.name,
          character: c.character,
          profilePath: c.profile_path,
          order: index,
        })),
      });
    }
  }

  private async syncTmdbSeriesEpisodes(seriesId: string, tmdbId: number, details: any) {
    try {
      const totalSeasons = Math.min(details.number_of_seasons || 1, 10);
      for (let sNum = 1; sNum <= totalSeasons; sNum++) {
        let seasonData: any = null;
        try {
          seasonData = await this.tmdb.tvSeasonDetails(tmdbId, sNum);
        } catch {
          seasonData = null;
        }

        const episodes = seasonData?.episodes ?? [];
        const season = await this.prisma.season.upsert({
          where: { seriesId_seasonNumber: { seriesId, seasonNumber: sNum } },
          update: {
            name: seasonData?.name || `Season ${sNum}`,
            episodeCount: episodes.length || seasonData?.episodes?.length || 0,
            posterPath: seasonData?.poster_path || null,
            overview: seasonData?.overview || null,
          },
          create: {
            seriesId,
            seasonNumber: sNum,
            name: seasonData?.name || `Season ${sNum}`,
            episodeCount: episodes.length || 0,
            posterPath: seasonData?.poster_path || null,
            overview: seasonData?.overview || null,
          },
        });

        if (episodes.length) {
          for (const ep of episodes) {
            const epNum = Number(ep.episode_number);
            if (!epNum) continue;
            await this.prisma.episode.upsert({
              where: { seasonId_episodeNumber: { seasonId: season.id, episodeNumber: epNum } },
              update: {
                title: ep.name || `Episode ${epNum}`,
                overview: ep.overview || null,
                stillPath: ep.still_path || null,
                airDate: ep.air_date ? new Date(ep.air_date) : null,
                runtime: ep.runtime || null,
                voteAverage: ep.vote_average || null,
              },
              create: {
                seriesId,
                seasonId: season.id,
                seasonNumber: sNum,
                episodeNumber: epNum,
                title: ep.name || `Episode ${epNum}`,
                overview: ep.overview || null,
                stillPath: ep.still_path || null,
                airDate: ep.air_date ? new Date(ep.air_date) : null,
                runtime: ep.runtime || null,
                voteAverage: ep.vote_average || null,
              },
            });
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to sync TMDB episodes for series ${seriesId}: ${err}`);
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

    if (movie.tmdbId) {
      return {
        mode: PlaybackMode.EMBED,
        available: true,
        source: ContentSource.MOVIESAPI,
        playerUrl: this.moviesApi.buildMovieEmbedPath(movie.tmdbId),
        sourcesUrl: `/api/player/sources/movie/${movie.tmdbId}`,
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

    if (series.tmdbId) {
      return {
        mode: PlaybackMode.EMBED,
        available: true,
        source: ContentSource.MOVIESAPI,
        playerUrl: this.moviesApi.buildTvEmbedPath(series.tmdbId, season, episode),
        sourcesUrl: `/api/player/sources/tv/${series.tmdbId}/${season}/${episode}`,
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
