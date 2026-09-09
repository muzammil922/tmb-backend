import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '../../../common/cache/cache.service';

export interface Imdb3Staff {
  staffId?: string;
  staffType?: number;
  name: string;
  character?: string;
  avatarUrl?: string;
  detailPath?: string;
}

export interface Imdb3MovieResult {
  id: string;
  title: string;
  backdrop_path?: string;
  release_date?: string;
  media_type?: string;
  vote_average?: string;
  channel?: any[];
  season?: any;
  genre?: string[];
  subjectid?: string;
  stafflist?: Imdb3Staff[];
  duration?: string;
  country?: string;
  embed?: any;
  dp?: string;
  dis?: string;
  trailer?: string | null;
}

export interface Imdb3ApiResponse {
  filters?: any[];
  pager?: {
    current_page?: number;
    items_per_page?: number;
    total_pages?: number;
    total_results?: number;
  };
  results?: Imdb3MovieResult[];
}

@Injectable()
export class Imdb3Client {
  private readonly logger = new Logger(Imdb3Client.name);
  private readonly baseUrl: string;
  private readonly movieboxBaseUrl: string;
  private readonly enabled: boolean;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.baseUrl = (this.config.get<string>('IMDB3_BASE_URL') || 'https://api2.imdb3.shop').replace(/\/$/, '');
    this.movieboxBaseUrl = (this.config.get<string>('MOVIEBOX_BASE_URL') || 'https://movie-box.co').replace(/\/$/, '');
    this.enabled = this.config.get<string>('IMDB3_ENABLED') !== 'false';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Fetch single movie metadata from https://api2.imdb3.shop/api/movie/{id}
   */
  async getMovieById(id: number | string): Promise<Imdb3MovieResult | null> {
    const cacheKey = `imdb3:movie:${id}`;
    const cached = await this.cache.get<Imdb3MovieResult>(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/api/movie/${id}`;
    try {
      const response = await firstValueFrom(
        this.http.get<Imdb3ApiResponse>(url, {
          headers: {
            Accept: 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          timeout: 25000,
        }),
      );

      const item = response.data?.results?.[0];
      if (item && item.title) {
        await this.cache.set(cacheKey, item, 600);
        return item;
      }
      return null;
    } catch (error: any) {
      this.logger.warn(`IMDB3 request failed for id ${id}: ${error?.message || 'unknown'}`);
      return null;
    }
  }

  /**
   * Query MovieBox subject play API to get playable MP4 video streams
   */
  async resolveStreamUrl(subjectId: string, detailPath?: string): Promise<string | null> {
    if (!subjectId) return null;

    const cacheKey = `moviebox:stream:${subjectId}`;
    const cached = await this.cache.get<string>(cacheKey);
    if (cached) return cached;

    const query = new URLSearchParams({
      subjectId,
      se: '0',
      ep: '0',
      streamSignType: '1',
      'supportCodecs[hevc]': '1',
      'supportCodecs[h264]': '1',
    });
    if (detailPath) {
      query.append('detailPath', detailPath);
    }

    const url = `${this.movieboxBaseUrl}/wefeed-h5api-bff/subject/play?${query.toString()}`;

    try {
      const response = await firstValueFrom(
        this.http.get<any>(url, {
          headers: {
            Accept: 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: `${this.movieboxBaseUrl}/`,
            Origin: this.movieboxBaseUrl,
          },
          timeout: 20000,
        }),
      );

      const data = response.data?.data;
      const streams: any[] = data?.streams || [];

      if (!Array.isArray(streams) || !streams.length) {
        return null;
      }

      // Priority 1: Unlocked 480p stream
      const unlocked480 = streams.find(
        (s) => s.vipLocked === false && s.resolutions === '480' && s.url,
      );
      if (unlocked480?.url) {
        await this.cache.set(cacheKey, unlocked480.url, 1800);
        return unlocked480.url;
      }

      // Priority 2: Any unlocked stream with a valid url
      const unlockedAny = streams.find((s) => s.vipLocked === false && s.url);
      if (unlockedAny?.url) {
        await this.cache.set(cacheKey, unlockedAny.url, 1800);
        return unlockedAny.url;
      }

      // Priority 3: First stream with url
      const firstValid = streams.find((s) => s.url);
      if (firstValid?.url) {
        await this.cache.set(cacheKey, firstValid.url, 1800);
        return firstValid.url;
      }

      return null;
    } catch (error: any) {
      this.logger.warn(`MovieBox stream resolve failed for subject ${subjectId}: ${error?.message || 'unknown'}`);
      return null;
    }
  }

  /**
   * Discovers new movies by querying sequential IDs
   */
  async discoverLatestMovies(startId: number, count = 20): Promise<Imdb3MovieResult[]> {
    const results: Imdb3MovieResult[] = [];
    const limit = Math.min(count, 50);

    for (let id = startId; id < startId + limit; id++) {
      try {
        const item = await this.getMovieById(id);
        if (item && item.title) {
          results.push(item);
        }
      } catch {
        // continue
      }
      // slight delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 100));
    }

    return results;
  }
}
