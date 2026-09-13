import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '../../common/cache/cache.service';
import { AllMangaClient } from './clients/allmanga.client';
import { EmbedSources, PlaybackSource } from './clients/embed-sources';
import { MoviesApiClient } from './clients/movies-api.client';

@Injectable()
export class PlayerService {
  private readonly logger = new Logger(PlayerService.name);
  private readonly apiUrl: string;
  private readonly embedSources: EmbedSources;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    private readonly cache: CacheService,
    private readonly moviesApi: MoviesApiClient,
    private readonly allManga: AllMangaClient,
  ) {
    this.apiUrl = (config.get<string>('API_URL') || 'http://localhost:4000').replace(/\/$/, '');
    this.embedSources = new EmbedSources(config);
  }

  getMovieSources(tmdbId: number) {
    return {
      tmdbId,
      type: 'movie',
      sources: this.embedSources.getMovieSources(tmdbId),
    };
  }

  getTvSources(tmdbId: number, season: number, episode: number, options?: { isAnime?: boolean; title?: string }) {
    const sources: PlaybackSource[] = [];

    if (options?.isAnime && this.allManga.isEnabled() && options.title) {
      const params = new URLSearchParams({
        title: options.title,
        season: String(season),
        episode: String(episode),
      });
      sources.push({
        id: 'allmanga',
        name: 'Server 1 (AllManga)',
        type: 'resolve',
        url: `/api/player/resolve/anime?${params.toString()}`,
      });
    }

    sources.push(...this.embedSources.getTvSources(tmdbId, season, episode));

    return {
      tmdbId,
      season,
      episode,
      isAnime: !!options?.isAnime,
      sources,
    };
  }

  getAnimeMovieSources(tmdbId: number, title: string) {
    const sources: PlaybackSource[] = [];

    if (this.allManga.isEnabled()) {
      const params = new URLSearchParams({ title, isMovie: 'true' });
      sources.push({
        id: 'allmanga',
        name: 'Server 1 (AllManga)',
        type: 'resolve',
        url: `/api/player/resolve/anime?${params.toString()}`,
      });
    }

    sources.push(...this.embedSources.getMovieSources(tmdbId));

    return {
      tmdbId,
      type: 'movie',
      isAnime: true,
      sources,
    };
  }

  async resolveAnime(options: {
    title: string;
    season?: number;
    episode?: number;
    isMovie?: boolean;
    dub?: boolean;
  }) {
    const cacheKey = `allmanga:${options.title}:${options.season ?? 1}:${options.episode ?? 1}:${options.isMovie ? 'movie' : 'tv'}:${options.dub ? 'dub' : 'sub'}`;
    const cached = await this.cache.get<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const result = await this.allManga.resolveEpisode({
      title: options.title,
      seasonNumber: options.season ?? 1,
      episodeNumber: options.episode ?? 1,
      isMovie: options.isMovie ?? false,
      dub: options.dub ?? false,
    });

    if (!result.ok || !result.url) {
      return result;
    }

    const proxiedUrl = `${this.apiUrl}/api/player/proxy?url=${this.encodeProxyParam(result.url)}&referer=${this.encodeProxyParam(result.referer || 'https://allmanga.to')}`;
    const payload = {
      ...result,
      directUrl: result.url,
      proxyUrl: proxiedUrl,
      playUrl: proxiedUrl,
    };

    await this.cache.set(cacheKey, payload, 1800);
    return payload;
  }

  buildUpstreamMovieEmbedUrl(tmdbId: number) {
    return this.embedSources.buildUpstreamMovieEmbedUrl(tmdbId);
  }

  buildUpstreamTvEmbedUrl(tmdbId: number, season: number, episode: number) {
    return this.embedSources.buildUpstreamTvEmbedUrl(tmdbId, season, episode);
  }

  async proxyResource(url: string, referer: string, res: Response) {
    if (!url || !this.isAllowedProxyUrl(url)) {
      throw new NotFoundException('Invalid stream URL');
    }

    try {
      const response = await firstValueFrom(
        this.http.get(url, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: {
            Accept: '*/*',
            Referer: referer || 'https://allmanga.to',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          validateStatus: (status) => status < 500,
        }),
      );

      const contentType = String(response.headers['content-type'] || '');

      if (contentType.includes('mpegurl') || contentType.includes('m3u8') || url.includes('.m3u8')) {
        const text = Buffer.from(response.data).toString('utf8');
        const rewritten = this.rewriteManifest(text, url, referer);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'public, max-age=30');
        res.send(rewritten);
        return;
      }

      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(Buffer.from(response.data));
    } catch (error) {
      this.logger.warn(`Player proxy failed for ${url}`);
      throw new NotFoundException('Stream unavailable');
    }
  }

  private rewriteManifest(content: string, manifestUrl: string, referer: string): string {
    const base = new URL(manifestUrl);
    return content
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;

        try {
          const absolute = new URL(trimmed, base).toString();
          if (!this.isAllowedProxyUrl(absolute)) return line;
          const proxy = `${this.apiUrl}/api/player/proxy?url=${this.encodeProxyParam(absolute)}&referer=${this.encodeProxyParam(referer)}`;
          return proxy;
        } catch {
          return line;
        }
      })
      .join('\n');
  }

  private encodeProxyParam(value: string) {
    return encodeURIComponent(value);
  }

  private isAllowedProxyUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }
}
