import { Injectable } from '@nestjs/common';
import { ContentSource, ContentType, PlaybackStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ContentSyncService } from '../../sync/content-sync.service';
import { SyncService } from '../../sync/sync.service';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { RecheckPlaybackDto } from './dto/recheck-playback.dto';
import { RunFullDto } from './dto/run-full.dto';

@Injectable()
export class AdminAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: SyncService,
    private readonly contentSync: ContentSyncService,
  ) {}

  runFull(dto: RunFullDto) {
    return this.syncService.runFullSync({
      presets: dto.presets,
      skipBroken: dto.skipBroken,
      contentType: dto.contentType,
    });
  }

  async getStats() {
    const [
      totalMovies,
      totalSeries,
      totalAnime,
      workingMovies,
      workingSeries,
      brokenMovies,
      brokenSeries,
      pendingMovies,
      pendingSeries,
      lastJob,
      presetGroups,
    ] = await Promise.all([
      this.prisma.movie.count(),
      this.prisma.series.count({ where: { contentType: ContentType.SERIES } }),
      this.prisma.series.count({ where: { contentType: ContentType.ANIME } }),
      this.prisma.movie.count({ where: { playbackStatus: PlaybackStatus.WORKING } }),
      this.prisma.series.count({ where: { playbackStatus: PlaybackStatus.WORKING } }),
      this.prisma.movie.count({ where: { playbackStatus: PlaybackStatus.BROKEN } }),
      this.prisma.series.count({ where: { playbackStatus: PlaybackStatus.BROKEN } }),
      this.prisma.movie.count({ where: { playbackStatus: PlaybackStatus.PENDING } }),
      this.prisma.series.count({ where: { playbackStatus: PlaybackStatus.PENDING } }),
      this.prisma.syncJob.findFirst({ orderBy: { createdAt: 'desc' } }),
      this.prisma.$queryRaw<{ syncPreset: string | null; count: bigint }[]>`
        SELECT "syncPreset", COUNT(*)::bigint as count FROM (
          SELECT "syncPreset" FROM "Movie" WHERE "syncPreset" IS NOT NULL
          UNION ALL
          SELECT "syncPreset" FROM "Series" WHERE "syncPreset" IS NOT NULL
        ) t GROUP BY "syncPreset"
      `.catch(() => []),
    ]);

    const byPreset: Record<string, number> = {};
    for (const row of presetGroups) {
      if (row.syncPreset) byPreset[row.syncPreset] = Number(row.count);
    }

    return {
      totalMovies,
      totalSeries,
      totalAnime,
      workingCount: workingMovies + workingSeries,
      brokenCount: brokenMovies + brokenSeries,
      pendingCount: pendingMovies + pendingSeries,
      lastSyncAt: lastJob?.completedAt ?? lastJob?.startedAt ?? null,
      byPreset,
    };
  }

  async getLibrary(query: {
    page?: number;
    limit?: number;
    search?: string;
    playbackStatus?: string;
    contentType?: string;
    syncPreset?: string;
    contentSource?: string;
  }) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(Math.max(1, Number(query.limit || 24)), 100);
    const skip = (page - 1) * limit;

    const movieWhere: Prisma.MovieWhereInput = {};
    const seriesWhere: Prisma.SeriesWhereInput = {};

    if (query.search?.trim()) {
      const search = query.search.trim();
      movieWhere.title = { contains: search, mode: 'insensitive' };
      seriesWhere.title = { contains: search, mode: 'insensitive' };
    }
    if (query.playbackStatus && query.playbackStatus !== 'all') {
      movieWhere.playbackStatus = query.playbackStatus as PlaybackStatus;
      seriesWhere.playbackStatus = query.playbackStatus as PlaybackStatus;
    }
    if (query.syncPreset && query.syncPreset !== 'all') {
      movieWhere.syncPreset = query.syncPreset;
      seriesWhere.syncPreset = query.syncPreset;
    }
    if (query.contentSource && query.contentSource !== 'all') {
      movieWhere.contentSource = query.contentSource as ContentSource;
      seriesWhere.contentSource = query.contentSource as ContentSource;
    }

    const includeMovies = !query.contentType || query.contentType === 'all' || query.contentType === 'MOVIE';
    const includeSeries =
      !query.contentType ||
      query.contentType === 'all' ||
      query.contentType === 'SERIES' ||
      query.contentType === 'ANIME';

    if (query.contentType === 'ANIME') {
      seriesWhere.contentType = ContentType.ANIME;
    } else if (query.contentType === 'SERIES') {
      seriesWhere.contentType = ContentType.SERIES;
    }

    const [movies, series, movieCount, seriesCount] = await Promise.all([
      includeMovies
        ? this.prisma.movie.findMany({
            where: movieWhere,
            orderBy: { updatedAt: 'desc' },
            take: limit,
            skip,
            include: { genres: { include: { genre: true } } },
          })
        : Promise.resolve([]),
      includeSeries
        ? this.prisma.series.findMany({
            where: seriesWhere,
            orderBy: { updatedAt: 'desc' },
            take: limit,
            skip,
            include: {
              genres: { include: { genre: true } },
              categorySeries: { include: { category: true } },
            },
          })
        : Promise.resolve([]),
      includeMovies ? this.prisma.movie.count({ where: movieWhere }) : Promise.resolve(0),
      includeSeries ? this.prisma.series.count({ where: seriesWhere }) : Promise.resolve(0),
    ]);

    const items = [
      ...movies.map((m) => ({
        id: m.id,
        title: m.title,
        type: 'MOVIE' as const,
        contentType: 'MOVIE' as const,
        syncPreset: m.syncPreset,
        playbackStatus: m.playbackStatus,
        contentSource: m.contentSource,
        posterPath: m.posterPath,
        categories: [],
        genres: m.genres.map((g) => g.genre),
      })),
      ...series.map((s) => ({
        id: s.id,
        title: s.title,
        type: s.contentType === ContentType.ANIME ? 'ANIME' : 'SERIES',
        contentType: s.contentType,
        syncPreset: s.syncPreset,
        playbackStatus: s.playbackStatus,
        contentSource: s.contentSource,
        posterPath: s.posterPath,
        categories: s.categorySeries.map((c) => c.category),
        genres: s.genres.map((g) => g.genre),
      })),
    ].sort((a, b) => a.title.localeCompare(b.title));

    const total = movieCount + seriesCount;

    return {
      data: items.slice(0, limit),
      page,
      totalPages: Math.ceil(total / limit) || 1,
      totalResults: total,
      movieCount,
      seriesCount,
    };
  }

  async bulkDelete(dto: BulkDeleteDto) {
    const movieWhere: Prisma.MovieWhereInput = {};
    const seriesWhere: Prisma.SeriesWhereInput = {};

    if (dto.playbackStatus) {
      movieWhere.playbackStatus = dto.playbackStatus;
      seriesWhere.playbackStatus = dto.playbackStatus;
    }
    if (dto.contentSource) {
      movieWhere.contentSource = dto.contentSource as ContentSource;
      seriesWhere.contentSource = dto.contentSource as ContentSource;
    }
    if (dto.syncPreset) {
      movieWhere.syncPreset = dto.syncPreset;
      seriesWhere.syncPreset = dto.syncPreset;
    }
    if (dto.contentType === 'ANIME') {
      seriesWhere.contentType = ContentType.ANIME;
    } else if (dto.contentType === 'SERIES') {
      seriesWhere.contentType = ContentType.SERIES;
    }

    const deleteMovies = dto.contentType !== 'SERIES' && dto.contentType !== 'ANIME';
    const deleteSeries = dto.contentType !== 'MOVIE';

    const [movies, series] = await Promise.all([
      deleteMovies ? this.prisma.movie.deleteMany({ where: movieWhere }) : Promise.resolve({ count: 0 }),
      deleteSeries ? this.prisma.series.deleteMany({ where: seriesWhere }) : Promise.resolve({ count: 0 }),
    ]);

    return { moviesDeleted: movies.count, seriesDeleted: series.count };
  }

  purgeUrduBox() {
    return this.contentSync.purgeUrduBoxContent();
  }

  async recheckPlayback(dto: RecheckPlaybackDto) {
    let movies: { id: string }[] = [];
    let series: { id: string }[] = [];

    if (dto.allBroken) {
      movies = await this.prisma.movie.findMany({
        where: { playbackStatus: PlaybackStatus.BROKEN },
        select: { id: true },
      });
      series = await this.prisma.series.findMany({
        where: { playbackStatus: PlaybackStatus.BROKEN },
        select: { id: true },
      });
    } else if (dto.playbackStatus) {
      movies = await this.prisma.movie.findMany({
        where: { playbackStatus: dto.playbackStatus },
        select: { id: true },
      });
      series = await this.prisma.series.findMany({
        where: { playbackStatus: dto.playbackStatus },
        select: { id: true },
      });
    } else {
      if (dto.movieIds?.length) {
        movies = dto.movieIds.map((id) => ({ id }));
      }
      if (dto.seriesIds?.length) {
        series = dto.seriesIds.map((id) => ({ id }));
      }
    }

    let working = 0;
    let broken = 0;
    let pending = 0;

    for (const m of movies) {
      const updated = await this.contentSync.recheckMoviePlayback(m.id);
      if (updated?.playbackStatus === PlaybackStatus.WORKING) working++;
      else if (updated?.playbackStatus === PlaybackStatus.BROKEN) broken++;
      else pending++;
    }

    for (const s of series) {
      const updated = await this.contentSync.recheckSeriesPlayback(s.id);
      if (updated?.playbackStatus === PlaybackStatus.WORKING) working++;
      else if (updated?.playbackStatus === PlaybackStatus.BROKEN) broken++;
      else pending++;
    }

    return {
      checked: movies.length + series.length,
      working,
      broken,
      pending,
    };
  }
}
