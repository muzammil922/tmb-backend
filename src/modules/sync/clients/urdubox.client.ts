import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '../../../common/cache/cache.service';

export interface UpstreamDiscoverItem {
  _id?: string;
  id?: string;
  tmdbId?: number | string;
  tmdbid?: number | string;
  title?: string;
  name?: string;
}

export interface UpstreamDiscoverResponse {
  results?: UpstreamDiscoverItem[];
  result?: boolean | UpstreamDiscoverItem[];
  data?: UpstreamDiscoverItem[];
  page?: number;
  totalPages?: number;
  total?: number;
  totalResults?: number;
}

@Injectable()
export class UrduboxClient {
  private readonly logger = new Logger(UrduboxClient.name);
  private readonly baseUrl: string;
  private readonly enabled: boolean;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.baseUrl = (this.config.get<string>('URDBOX_BASE_URL') || 'https://urdubox.pk').replace(/\/$/, '');
    this.enabled = this.config.get<string>('URDBOX_ENABLED') === 'true';
  }

  isEnabled() {
    return this.enabled;
  }

  private async request<T>(path: string, params: Record<string, string | number> = {}, ttl = 300): Promise<T | null> {
    if (!this.enabled) return null;

    const cacheKey = `urdubox:${path}:${JSON.stringify(params)}`;
    const cached = await this.cache.get<T>(cacheKey);
    if (cached) return cached;

    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    );
    const url = `${this.baseUrl}${path}${query.toString() ? `?${query.toString()}` : ''}`;

    try {
      const response = await firstValueFrom(
        this.http.get<T>(url, {
          headers: {
            Accept: 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: `${this.baseUrl}/`,
            'Accept-Language': 'en-US,en;q=0.9',
          },
          timeout: 30000,
        }),
      );
      await this.cache.set(cacheKey, response.data, ttl);
      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message ?? error?.message ?? 'unknown';
      this.logger.warn(`Urdubox request failed: ${url} (${status ?? 'network'}: ${message})`);
      return null;
    }
  }

  discoverMovies(page = 1, resultsPerPage = 50) {
    return this.request<UpstreamDiscoverResponse>('/api/movies/public', {
      page,
      limit: resultsPerPage,
      ordering: 'views',
      direction: 'desc',
    });
  }

  discoverTv(page = 1, resultsPerPage = 50) {
    return this.request<UpstreamDiscoverResponse>('/api/series/public', {
      page,
      limit: resultsPerPage,
      ordering: 'views',
      direction: 'desc',
    });
  }

  async findMovieByTmdbId(tmdbId: number) {
    return this.findByTmdbId('/api/movies/public', tmdbId);
  }

  async findSeriesByTmdbId(tmdbId: number) {
    return this.findByTmdbId('/api/series/public', tmdbId);
  }

  private async findByTmdbId(path: string, tmdbId: number, maxPages = 30) {
    for (let page = 1; page <= maxPages; page++) {
      const response = await this.request<UpstreamDiscoverResponse>(
        path,
        {
          page,
          limit: 50,
          ordering: 'views',
          direction: 'desc',
        },
        60,
      );
      const items = this.extractItems(response);
      const match = items.find((item) => this.resolveTmdbId(item) === tmdbId);
      if (match) return { data: [match], results: [match] };

      if (!items.length || items.length < 50) break;
    }

    return { data: [], results: [] };
  }

  getMoviePublic(upstreamId: string) {
    return this.request<any>(`/api/movies/public/${upstreamId}`, {}, 120);
  }

  getSeriesPublic(upstreamId: string) {
    return this.request<any>(`/api/series/public/${upstreamId}`, {}, 120);
  }

  extractBestStreamLink(payload: any): StreamLink | null {
    if (!payload) return null;

    const links: StreamLink[] =
      payload.streamingLinks ??
      payload.streamLinks ??
      payload.streams ??
      payload.movie?.streamingLinks ??
      [];

    if (!Array.isArray(links) || !links.length) return null;

    const normalized = links
      .map((link) => this.normalizeStreamLink(link))
      .filter((link): link is StreamLink => !!link?.url);

    if (!normalized.length) return null;

    const preferred = normalized.find((link) => /720|1080|480/.test(link.quality || '')) ?? normalized[0];
    return preferred;
  }

  extractEpisodeStreamLink(payload: any, seasonNumber: number, episodeNumber: number): StreamLink | null {
    if (!payload) return null;

    const seasons = payload.seasons ?? payload.data?.seasons ?? [];
    const season = seasons.find(
      (s: any) => Number(s.seasonNumber ?? s.season ?? s.number) === seasonNumber,
    );
    if (!season) return null;

    const episodes = season.episodes ?? season.items ?? [];
    const episode = episodes.find(
      (e: any) => Number(e.episodeNumber ?? e.episode ?? e.number) === episodeNumber,
    );
    if (!episode) return null;

    const links: StreamLink[] = episode.streamingLinks ?? episode.streamLinks ?? episode.streams ?? [];
    if (!Array.isArray(links) || !links.length) return null;

    const normalized = links
      .map((link) => this.normalizeStreamLink(link))
      .filter((link): link is StreamLink => !!link?.url);

    return normalized.find((link) => /720|1080|480/.test(link.quality || '')) ?? normalized[0] ?? null;
  }

  private normalizeStreamLink(link: any): StreamLink | null {
    if (!link) return null;

    const url = link.url ?? link.link ?? link.src ?? link.m3u8;
    if (typeof url !== 'string' || !url.includes('.m3u8')) return null;

    return {
      quality: link.quality ?? link.label ?? link.resolution,
      url,
      token: link.token,
      expires: link.expires,
    };
  }

  extractItems(response: UpstreamDiscoverResponse | null): UpstreamDiscoverItem[] {
    if (!response) return [];
    if (Array.isArray(response.data)) return response.data;
    if (Array.isArray(response.results)) return response.results;
    if (Array.isArray(response.result)) return response.result;
    return [];
  }

  resolveTmdbId(item: UpstreamDiscoverItem): number | null {
    const id = item.tmdbId ?? item.tmdbid;
    if (typeof id === 'number' && Number.isFinite(id)) return id;
    if (typeof id === 'string' && /^\d+$/.test(id)) return Number(id);
    return null;
  }

  resolveUpstreamId(item: UpstreamDiscoverItem): string | null {
    const id = item._id ?? item.id;
    return typeof id === 'string' ? id : null;
  }
}

export interface StreamLink {
  quality?: string;
  url: string;
  token?: string;
  expires?: string | number;
}
