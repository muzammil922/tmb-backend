import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ContentType, ContentSource, MovieStatus, PlaybackMode, Prisma } from '@prisma/client';
import { publicSeriesFilter } from '../../common/content-filters';
import { PrismaService } from '../../prisma/prisma.service';
import { TmdbService } from '../tmdb/tmdb.service';
import { CacheService } from '../../common/cache/cache.service';
import { Imdb3Client } from '../sync/clients/imdb3.client';
import { PlayerService } from '../sync/player.service';
import { isAnimeContent } from '../sync/helpers/anime.helper';

export interface SeriesFilterQuery {
  category?: string;
  search?: string;
  type?: 'ALL' | 'SERIES' | 'ANIME';
  status?: string;
  source?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class SeriesService {
  private readonly logger = new Logger(SeriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdb: TmdbService,
    private readonly cache: CacheService,
    private readonly player: PlayerService,
    private readonly imdb3: Imdb3Client,
  ) {}

  async listSeries(query: SeriesFilterQuery = {}) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(Math.max(1, Number(query.limit || 24)), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.SeriesWhereInput = { ...publicSeriesFilter };

    if (query.status && query.status !== 'all') {
      if (query.status === 'live' || query.status === 'ACTIVE') {
        where.status = MovieStatus.ACTIVE;
      } else if (query.status === 'draft' || query.status === 'DRAFT') {
        where.status = MovieStatus.DRAFT;
      }
    }

    if (query.source && query.source !== 'all') {
      const srcUpper = query.source.toUpperCase();
      if (srcUpper in ContentSource) {
        where.contentSource = srcUpper as ContentSource;
      }
    }

    if (query.type === 'ANIME') {
      where.contentType = ContentType.ANIME;
    } else if (query.type === 'SERIES') {
      where.contentType = ContentType.SERIES;
    }

    if (query.search?.trim()) {
      where.title = { contains: query.search.trim(), mode: 'insensitive' };
    }

    if (query.category && query.category !== 'all') {
      where.categorySeries = {
        some: {
          category: {
            slug: query.category,
          },
        },
      };
    }

    const [seriesList, total, webSeriesCount, animeCount, activeCount, draftCount] = await Promise.all([
      this.prisma.series.findMany({
        where,
        include: {
          categorySeries: { include: { category: true } },
          genres: { include: { genre: true } },
          seasons: {
            select: {
              id: true,
              seasonNumber: true,
              name: true,
              episodeCount: true,
            },
            orderBy: { seasonNumber: 'asc' },
          },
        },
        orderBy: { rating: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.series.count({ where }),
      this.prisma.series.count({ where: { contentType: ContentType.SERIES } }),
      this.prisma.series.count({ where: { contentType: ContentType.ANIME } }),
      this.prisma.series.count({ where: { status: MovieStatus.ACTIVE } }),
      this.prisma.series.count({ where: { status: MovieStatus.DRAFT } }),
    ]);

    const mapped = seriesList.map((s) => ({
      id: s.id,
      tmdbId: s.tmdbId,
      title: s.title,
      originalTitle: s.originalTitle,
      overview: s.overview,
      posterPath: s.posterPath,
      backdropPath: s.backdropPath,
      firstAirDate: s.firstAirDate?.toISOString().split('T')[0] ?? null,
      lastAirDate: s.lastAirDate?.toISOString().split('T')[0] ?? null,
      numberOfSeasons: s.numberOfSeasons || s.seasons?.length || 1,
      numberOfEpisodes: s.numberOfEpisodes || 1,
      rating: s.rating,
      voteCount: s.voteCount,
      language: s.language,
      status: s.status,
      contentType: s.contentType,
      contentSource: s.contentSource,
      categories: s.categorySeries.map((cs) => cs.category),
      genres: s.genres.map((g) => g.genre),
      seasons: s.seasons,
    }));

    return {
      data: mapped,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      total,
      totalResults: total,
      webSeriesCount,
      animeCount,
      activeCount,
      draftCount,
    };
  }

  async getSeriesById(idOrTmdb: string) {
    const isNum = /^\d+$/.test(idOrTmdb);
    const where: Prisma.SeriesWhereInput = isNum
      ? { OR: [{ id: idOrTmdb }, { tmdbId: Number(idOrTmdb) }] }
      : { id: idOrTmdb };

    let series = await this.prisma.series.findFirst({
      where: { ...where, ...publicSeriesFilter },
      include: {
        categorySeries: { include: { category: true } },
        genres: { include: { genre: true } },
        cast: { orderBy: { order: 'asc' } },
        seasons: {
          orderBy: { seasonNumber: 'asc' },
          include: {
            episodes: {
              orderBy: { episodeNumber: 'asc' },
            },
          },
        },
      },
    });

    if (!series) {
      throw new NotFoundException('Series not found');
    }

    // If seasons are missing and we have tmdbId, auto-populate seasons and episodes
    if ((!series.seasons || series.seasons.length === 0) && series.tmdbId) {
      await this.ensureSeasonsAndEpisodes(series.id, series.tmdbId, series.contentSource, series.upstreamId);
      series = await this.prisma.series.findUnique({
        where: { id: series.id },
        include: {
          categorySeries: { include: { category: true } },
          genres: { include: { genre: true } },
          cast: { orderBy: { order: 'asc' } },
          seasons: {
            orderBy: { seasonNumber: 'asc' },
            include: {
              episodes: {
                orderBy: { episodeNumber: 'asc' },
              },
            },
          },
        },
      });
    }

    return {
      id: series!.id,
      tmdbId: series!.tmdbId,
      title: series!.title,
      originalTitle: series!.originalTitle,
      overview: series!.overview,
      posterPath: series!.posterPath,
      backdropPath: series!.backdropPath,
      firstAirDate: series!.firstAirDate?.toISOString().split('T')[0] ?? null,
      lastAirDate: series!.lastAirDate?.toISOString().split('T')[0] ?? null,
      numberOfSeasons: series!.numberOfSeasons || series!.seasons?.length || 1,
      numberOfEpisodes: series!.numberOfEpisodes || 1,
      rating: series!.rating,
      voteCount: series!.voteCount,
      language: series!.language,
      contentType: series!.contentType,
      contentSource: series!.contentSource,
      playbackMode: series!.playbackMode,
      upstreamId: series!.upstreamId,
      categories: series!.categorySeries.map((cs) => cs.category),
      genres: series!.genres.map((g) => g.genre),
      cast: series!.cast,
      seasons: series!.seasons,
    };
  }

  async getEpisodePlayback(seriesId: string, seasonNumber: number, episodeNumber: number) {
    const series = await this.prisma.series.findUnique({
      where: { id: seriesId },
      include: {
        seasons: {
          where: { seasonNumber },
          include: {
            episodes: {
              where: { episodeNumber },
            },
          },
        },
      },
    });

    if (!series) throw new NotFoundException('Series not found');

    const episode = series.seasons?.[0]?.episodes?.[0];
    const tmdbId = series.tmdbId;

    const sources: {
      id: string;
      name: string;
      url: string;
      type: 'hls' | 'mp4' | 'embed' | 'resolve';
    }[] = [];

    if (episode?.videoUrl) {
      const isHls = episode.videoUrl.includes('.m3u8');
      sources.push({
        id: 'server-direct',
        name: isHls ? 'Server 1 (HLS Ultra Fast)' : 'Server 1 (Direct HD)',
        url: episode.videoUrl,
        type: isHls ? 'hls' : 'mp4',
      });
    }

    if (tmdbId) {
      const isAnime =
        series.contentType === ContentType.ANIME ||
        isAnimeContent({
          original_language: series.language,
          contentType: series.contentType,
        });
      const playerSources = await this.player.getTvSources(tmdbId, seasonNumber, episodeNumber, {
        isAnime,
        title: series.title,
      });
      sources.push(...playerSources.sources);
    }

    return {
      seriesId: series.id,
      title: series.title,
      seasonNumber,
      episodeNumber,
      episodeTitle: episode?.title || `Episode ${episodeNumber}`,
      episodeOverview: episode?.overview || '',
      stillPath: episode?.stillPath || series.backdropPath,
      sources,
    };
  }

  private async ensureSeasonsAndEpisodes(
    seriesId: string,
    tmdbId: number,
    contentSource?: ContentSource | null,
    upstreamId?: string | null,
  ) {
    try {
      // Default to TMDB TV details
      const tvDetails: any = await this.tmdb.tvDetails(tmdbId);
      const totalSeasons = tvDetails?.number_of_seasons || 1;

      for (let sNum = 1; sNum <= Math.min(totalSeasons, 10); sNum++) {
        const season = await this.prisma.season.upsert({
          where: {
            seriesId_seasonNumber: {
              seriesId,
              seasonNumber: sNum,
            },
          },
          update: {},
          create: {
            seriesId,
            seasonNumber: sNum,
            name: `Season ${sNum}`,
            episodeCount: Math.min(tvDetails?.number_of_episodes || 12, 24),
          },
        });

        // Generate season episodes
        const episodesCount = Math.min(Math.round((tvDetails?.number_of_episodes || 12) / totalSeasons) || 10, 24);
        for (let epNum = 1; epNum <= episodesCount; epNum++) {
          await this.prisma.episode.upsert({
            where: {
              seasonId_episodeNumber: {
                seasonId: season.id,
                episodeNumber: epNum,
              },
            },
            update: {},
            create: {
              seriesId,
              seasonId: season.id,
              seasonNumber: sNum,
              episodeNumber: epNum,
              title: `Episode ${epNum}`,
              overview: `Season ${sNum}, Episode ${epNum} of ${tvDetails.name || 'Series'}`,
              stillPath: tvDetails.backdrop_path,
            },
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to auto-populate episodes for series ${seriesId}: ${error}`);
    }
  }

  async deleteSeries(id: string) {
    return this.prisma.series.delete({
      where: { id },
    });
  }

  async updateSeries(id: string, data: Partial<{ status: MovieStatus; title: string; overview: string; contentType: ContentType }>) {
    return this.prisma.series.update({
      where: { id },
      data,
    });
  }

  async bulkUpdateStatus(data: { ids?: string[]; status: MovieStatus; all?: boolean }) {
    if (data.all) {
      return this.prisma.series.updateMany({
        data: { status: data.status },
      });
    }
    if (data.ids && data.ids.length > 0) {
      return this.prisma.series.updateMany({
        where: { id: { in: data.ids } },
        data: { status: data.status },
      });
    }
    return { count: 0 };
  }

  async bulkDelete(data: { ids?: string[]; all?: boolean }) {
    if (data.all) {
      return this.prisma.series.deleteMany({});
    }
    if (data.ids && data.ids.length > 0) {
      return this.prisma.series.deleteMany({
        where: { id: { in: data.ids } },
      });
    }
    return { count: 0 };
  }
}


