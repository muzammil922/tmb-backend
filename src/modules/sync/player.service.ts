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

  async getMovieSources(tmdbId: number) {
    const cacheKey = `player:sources:movie:${tmdbId}`;
    const cached = await this.cache.get<{ tmdbId: number; type: string; sources: PlaybackSource[] }>(cacheKey);
    if (cached) {
      return cached;
    }

    const candidateSources = this.embedSources.getMovieSources(tmdbId);
    const verifiedSources = await this.probeAndSortSources(candidateSources);

    const payload = {
      tmdbId,
      type: 'movie',
      sources: verifiedSources,
    };

    await this.cache.set(cacheKey, payload, 1800);
    return payload;
  }

  async getTvSources(tmdbId: number, season: number, episode: number, options?: { isAnime?: boolean; title?: string }) {
    const cacheKey = `player:sources:tv:${tmdbId}:${season}:${episode}:${options?.isAnime ? 'anime' : 'tv'}`;
    const cached = await this.cache.get<{ tmdbId: number; season: number; episode: number; isAnime: boolean; sources: PlaybackSource[] }>(cacheKey);
    if (cached) {
      return cached;
    }

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

    const candidateSources = this.embedSources.getTvSources(tmdbId, season, episode);
    const verifiedSources = await this.probeAndSortSources(candidateSources);
    sources.push(...verifiedSources);

    const payload = {
      tmdbId,
      season,
      episode,
      isAnime: !!options?.isAnime,
      sources,
    };

    await this.cache.set(cacheKey, payload, 1800);
    return payload;
  }

  async getAnimeMovieSources(tmdbId: number, title: string) {
    const cacheKey = `player:sources:anime-movie:${tmdbId}`;
    const cached = await this.cache.get<{ tmdbId: number; type: string; isAnime: boolean; sources: PlaybackSource[] }>(cacheKey);
    if (cached) {
      return cached;
    }

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

    const candidateSources = this.embedSources.getMovieSources(tmdbId);
    const verifiedSources = await this.probeAndSortSources(candidateSources);
    sources.push(...verifiedSources);

    const payload = {
      tmdbId,
      type: 'movie',
      isAnime: true,
      sources,
    };

    await this.cache.set(cacheKey, payload, 1800);
    return payload;
  }

  private async probeAndSortSources(sources: PlaybackSource[]): Promise<PlaybackSource[]> {
    try {
      const checks = await Promise.allSettled(
        sources.map(async (source) => {
          const targetUrl = source.url;
          if (!targetUrl.startsWith('http')) {
            return { source, ok: true, time: 20 };
          }

          const start = Date.now();
          const response = await firstValueFrom(
            this.http.head(targetUrl, {
              timeout: 1800,
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              },
              validateStatus: (status) => status < 400,
            }),
          );
          return { source, ok: response.status < 400, time: Date.now() - start };
        }),
      );

      const successful: { source: PlaybackSource; time: number }[] = [];
      const failed: PlaybackSource[] = [];

      checks.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value.ok) {
          successful.push({ source: result.value.source, time: result.value.time });
        } else {
          failed.push(sources[idx]);
        }
      });

      // Keep Server 1 (Vidking HD) first if online, then sort remaining by speed
      const sorted = successful
        .sort((a, b) => {
          if (a.source.id === 'vidking') return -1;
          if (b.source.id === 'vidking') return 1;
          return a.time - b.time;
        })
        .map((item) => item.source);

      // Re-number neatly as Server 1, Server 2, etc.
      const finalSources = [...sorted, ...failed].map((src, i) => {
        const cleanName = src.name.replace(/^Server \d+ /, '');
        return {
          ...src,
          name: `Server ${i + 1} ${cleanName}`,
        };
      });

      return finalSources;
    } catch {
      return sources;
    }
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

  async renderCleanMovieEmbed(tmdbId: number): Promise<string> {
    const upstreamUrl = `https://www.vidking.net/embed/movie/${tmdbId}?autoPlay=true`;
    try {
      const response = await firstValueFrom(
        this.http.get(upstreamUrl, {
          timeout: 8000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
          responseType: 'text',
        }),
      );
      const html = String(response.data || '');
      if (html.includes('<head>')) {
        const injected = `<base href="https://www.vidking.net/">
<script>
  try {
    sessionStorage.setItem("adsEnabled", "false");
    window.open = function() { return null; };
  } catch(e) {}
</script>`;
        return html.replace('<head>', '<head>' + injected);
      }
      return html;
    } catch {
      return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stream Player</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style>
</head><body><iframe src="${upstreamUrl}" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe></body></html>`;
    }
  }

  async renderCleanTvEmbed(tmdbId: number, season: number, episode: number): Promise<string> {
    const upstreamUrl = `https://www.vidking.net/embed/tv/${tmdbId}/${season}/${episode}?autoPlay=true`;
    try {
      const response = await firstValueFrom(
        this.http.get(upstreamUrl, {
          timeout: 8000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
          responseType: 'text',
        }),
      );
      const html = String(response.data || '');
      if (html.includes('<head>')) {
        const injected = `<base href="https://www.vidking.net/">
<script>
  try {
    sessionStorage.setItem("adsEnabled", "false");
    window.open = function() { return null; };
  } catch(e) {}
</script>`;
        return html.replace('<head>', '<head>' + injected);
      }
      return html;
    } catch {
      return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stream Player</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style>
</head><body><iframe src="${upstreamUrl}" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe></body></html>`;
    }
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
