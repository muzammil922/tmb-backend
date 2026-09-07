import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '../../../common/cache/cache.service';
import { UpstreamDiscoverItem, UpstreamDiscoverResponse } from './urdubox.client';

@Injectable()
export class MoviesApiClient {
  private readonly logger = new Logger(MoviesApiClient.name);
  private readonly baseUrl: string;
  private readonly theme: string;
  private readonly enabled: boolean;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.baseUrl = (this.config.get<string>('MOVIESAPI_BASE_URL') || 'https://moviesapi.to').replace(/\/$/, '');
    this.theme = this.config.get<string>('MOVIESAPI_THEME') || '8b5cf6';
    this.enabled = this.config.get<string>('MOVIESAPI_ENABLED') === 'true';
  }

  isEnabled() {
    return this.enabled;
  }

  getTheme() {
    return this.theme;
  }

  private async request<T>(path: string, params: Record<string, string | number> = {}, ttl = 300): Promise<T | null> {
    if (!this.enabled) return null;

    const cacheKey = `moviesapi:${path}:${JSON.stringify(params)}`;
    const cached = await this.cache.get<T>(cacheKey);
    if (cached) return cached;

    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    );
    const url = `${this.baseUrl}${path}?${query.toString()}`;

    try {
      const response = await firstValueFrom(
        this.http.get<T>(url, {
          headers: { Accept: 'application/json' },
          timeout: 30000,
        }),
      );
      await this.cache.set(cacheKey, response.data, ttl);
      return response.data;
    } catch (error) {
      this.logger.warn(`MoviesAPI request failed: ${url}`);
      return null;
    }
  }

  discoverMovies(page = 1, resultsPerPage = 50) {
    return this.request<UpstreamDiscoverResponse>('/api/discover/movies', {
      page,
      resultsPerPage,
      ordering: 'views',
      direction: 'desc',
    });
  }

  discoverTv(page = 1, resultsPerPage = 50) {
    return this.request<UpstreamDiscoverResponse>('/api/discover/tv', {
      page,
      resultsPerPage,
      ordering: 'views',
      direction: 'desc',
    });
  }

  findMovieByTmdbId(tmdbId: number) {
    return this.request<UpstreamDiscoverResponse>('/api/discover/movies', {
      page: 1,
      resultsPerPage: 5,
      tmdbid: tmdbId,
    }, 60);
  }

  buildMovieEmbedPath(tmdbId: number) {
    return `/api/player/embed/movie/${tmdbId}?theme=${this.theme}`;
  }

  buildTvEmbedPath(tmdbId: number, season: number, episode: number) {
    return `/api/player/embed/tv/${tmdbId}/${season}/${episode}?theme=${this.theme}`;
  }

  buildUpstreamMovieEmbedUrl(tmdbId: number) {
    return `${this.baseUrl}/movie/${tmdbId}?theme=${this.theme}`;
  }

  buildUpstreamTvEmbedUrl(tmdbId: number, season: number, episode: number) {
    return `${this.baseUrl}/tv/${tmdbId}/${season}/${episode}?theme=${this.theme}`;
  }

  extractItems(response: UpstreamDiscoverResponse | null): UpstreamDiscoverItem[] {
    if (!response) return [];
    return response.results ?? response.data ?? [];
  }

  resolveTmdbId(item: UpstreamDiscoverItem): number | null {
    const id = item.tmdbId ?? item.tmdbid;
    return typeof id === 'number' ? id : null;
  }
}
