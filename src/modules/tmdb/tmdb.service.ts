import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '../../common/cache/cache.service';

@Injectable()
export class TmdbService {
  private readonly logger = new Logger(TmdbService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly readToken: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.baseUrl = this.config.get<string>('TMDB_BASE_URL') || 'https://api.themoviedb.org/3';
    this.apiKey = this.config.get<string>('TMDB_API_KEY') || '';
    this.readToken = this.config.get<string>('TMDB_READ_ACCESS_TOKEN') || '';
  }

  private get headers() {
    if (this.readToken) {
      return { Authorization: `Bearer ${this.readToken}` };
    }
    return {};
  }

  private async request<T>(path: string, params: Record<string, string | number> = {}, ttl = 3600): Promise<T> {
    const cacheKey = `tmdb:${path}:${JSON.stringify(params)}`;
    const cached = await this.cache.get<T>(cacheKey);
    if (cached) return cached;

    const query = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    });
    if (this.apiKey && !this.readToken) {
      query.set('api_key', this.apiKey);
    }

    const url = `${this.baseUrl}${path}?${query.toString()}`;
    try {
      const response = await firstValueFrom(this.http.get<T>(url, { headers: this.headers }));
      await this.cache.set(cacheKey, response.data, ttl);
      return response.data;
    } catch (error) {
      this.logger.error(`TMDB request failed: ${path}`, error);
      throw error;
    }
  }

  trending(page = 1) {
    return this.request('/trending/movie/week', { page }, 3600);
  }

  popular(page = 1) {
    return this.request('/movie/popular', { page }, 21600);
  }

  topRated(page = 1) {
    return this.request('/movie/top_rated', { page }, 21600);
  }

  upcoming(page = 1) {
    return this.request('/movie/upcoming', { page }, 3600);
  }

  nowPlaying(page = 1) {
    return this.request('/movie/now_playing', { page }, 3600);
  }

  genres() {
    return this.request('/genre/movie/list', {}, 604800);
  }

  movieDetails(id: number) {
    return this.request(`/movie/${id}`, { append_to_response: 'videos,credits' }, 86400);
  }

  tvDetails(id: number) {
    return this.request(`/tv/${id}`, { append_to_response: 'videos,credits' }, 86400);
  }

  movieCredits(id: number) {
    return this.request(`/movie/${id}/credits`, {}, 86400);
  }

  movieVideos(id: number) {
    return this.request(`/movie/${id}/videos`, {}, 86400);
  }

  similar(id: number, page = 1) {
    return this.request(`/movie/${id}/similar`, { page }, 86400);
  }

  recommendations(id: number, page = 1) {
    return this.request(`/movie/${id}/recommendations`, { page }, 86400);
  }

  search(query: string, page = 1) {
    return this.request('/search/multi', { query, page, include_adult: 'false' }, 1800);
  }

  searchMovies(query: string, page = 1) {
    return this.request('/search/movie', { query, page }, 1800);
  }

  discoverByGenre(genreId: number, page = 1) {
    return this.request('/discover/movie', { with_genres: genreId, page, sort_by: 'popularity.desc' }, 3600);
  }

  discoverMovies(params: Record<string, string | number>, page = 1) {
    return this.request('/discover/movie', { ...params, page }, 3600);
  }

  discoverTv(params: Record<string, string | number>, page = 1) {
    return this.request('/discover/tv', { ...params, page }, 3600);
  }

  trendingTv(page = 1) {
    return this.request('/trending/tv/week', { page }, 3600);
  }

  tvSeasonDetails(tmdbId: number, season: number) {
    return this.request(`/tv/${tmdbId}/season/${season}`, {}, 86400);
  }
}
