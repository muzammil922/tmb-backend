import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ContentType, PlaybackMode } from '@prisma/client';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { UrduboxClient } from './clients/urdubox.client';

export interface StreamLink {
  quality?: string;
  url: string;
  token?: string;
  expires?: string | number;
}

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);
  private readonly apiUrl: string;
  private readonly allowedHosts: string[];

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly urdubox: UrduboxClient,
  ) {
    this.apiUrl = (this.config.get<string>('API_URL') || 'http://localhost:4000').replace(/\/$/, '');
    this.allowedHosts = (this.config.get<string>('STREAM_ALLOWED_HOSTS') || 'streamraiwind.stream,movie22.cc')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
  }

  async getMoviePlayback(tmdbId: number) {
    const movie = await this.prisma.movie.findUnique({ where: { tmdbId } });
    if (!movie || movie.playbackMode !== PlaybackMode.URDBOX) {
      return { available: false, message: 'Stream not available' };
    }

    return {
      available: true,
      tmdbId,
      type: 'hls',
      hlsUrl: `${this.apiUrl}/api/stream/movie/${tmdbId}/playlist.m3u8`,
    };
  }

  async getSeriesPlayback(tmdbId: number, season: number, episode: number) {
    const series = await this.prisma.series.findUnique({ where: { tmdbId } });
    if (!series || series.playbackMode !== PlaybackMode.URDBOX) {
      return { available: false, message: 'Stream not available' };
    }

    return {
      available: true,
      tmdbId,
      season,
      episode,
      type: 'hls',
      hlsUrl: `${this.apiUrl}/api/stream/tv/${tmdbId}/${season}/${episode}/playlist.m3u8`,
    };
  }

  async serveMovieManifest(tmdbId: number, res: Response) {
    const movie = await this.prisma.movie.findUnique({ where: { tmdbId } });
    if (!movie?.upstreamId || movie.playbackMode !== PlaybackMode.URDBOX) {
      throw new NotFoundException('Stream not found');
    }

    const upstream = await this.urdubox.getMoviePublic(movie.upstreamId);
    const link = this.urdubox.extractBestStreamLink(upstream);
    if (!link) throw new NotFoundException('No stream links available');

    await this.serveRewrittenManifest(link.url, res);
  }

  async serveEpisodeManifest(tmdbId: number, season: number, episode: number, res: Response) {
    const series = await this.prisma.series.findUnique({ where: { tmdbId } });
    if (!series?.upstreamId || series.playbackMode !== PlaybackMode.URDBOX) {
      throw new NotFoundException('Stream not found');
    }

    const upstream = await this.urdubox.getSeriesPublic(series.upstreamId);
    const link = this.urdubox.extractEpisodeStreamLink(upstream, season, episode);
    if (!link) throw new NotFoundException('Episode stream not found');

    await this.serveRewrittenManifest(link.url, res);
  }

  async proxyResource(encoded: string, res: Response) {
    const url = this.decodeProxyUrl(encoded);
    if (!this.isAllowedUrl(url)) {
      throw new NotFoundException('Invalid stream URL');
    }

    try {
      const response = await firstValueFrom(
        this.http.get(url, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: { Accept: '*/*' },
          validateStatus: (status) => status < 500,
        }),
      );

      const contentType = String(response.headers['content-type'] || '');
      if (contentType.includes('mpegurl') || contentType.includes('m3u8') || url.includes('.m3u8')) {
        const text = Buffer.from(response.data).toString('utf8');
        await this.serveRewrittenManifest(url, res, text);
        return;
      }

      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      if (response.headers['cache-control']) {
        res.setHeader('Cache-Control', String(response.headers['cache-control']));
      }
      res.send(Buffer.from(response.data));
    } catch (error) {
      this.logger.warn(`Stream proxy failed for ${url}`);
      throw new NotFoundException('Stream segment unavailable');
    }
  }

  private async serveRewrittenManifest(sourceUrl: string, res: Response, prefetched?: string) {
    let content = prefetched;
    if (!content) {
      const response = await firstValueFrom(
        this.http.get(sourceUrl, {
          responseType: 'text',
          timeout: 30000,
          headers: { Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, */*' },
        }),
      );
      content = response.data as string;
    }

    const rewritten = this.rewriteManifest(content ?? '', sourceUrl);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(rewritten);
  }

  private rewriteManifest(content: string, manifestUrl: string): string {
    const base = new URL(manifestUrl);
    const lines = content.split(/\r?\n/);

    return lines
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;

        const absolute = this.resolveUrl(trimmed, base);
        if (!this.isAllowedUrl(absolute)) return line;

        return `${this.apiUrl}/api/stream/proxy/${this.encodeProxyUrl(absolute)}`;
      })
      .join('\n');
  }

  private resolveUrl(relativeOrAbsolute: string, base: URL): string {
    try {
      return new URL(relativeOrAbsolute, base).toString();
    } catch {
      return relativeOrAbsolute;
    }
  }

  encodeProxyUrl(url: string): string {
    return Buffer.from(url, 'utf8').toString('base64url');
  }

  private decodeProxyUrl(encoded: string): string {
    return Buffer.from(encoded, 'base64url').toString('utf8');
  }

  private isAllowedUrl(url: string): boolean {
    try {
      const host = new URL(url).hostname;
      return this.allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    } catch {
      return false;
    }
  }
}
