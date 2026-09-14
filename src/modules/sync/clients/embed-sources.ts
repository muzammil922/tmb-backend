import { ConfigService } from '@nestjs/config';

export type EmbedSourceId = 'videasy' | 'vidking' | 'vidsrc' | 'moviesapi';

export interface PlaybackSource {
  id: string;
  name: string;
  type: 'embed' | 'mp4' | 'hls' | 'resolve';
  url: string;
}

export class EmbedSources {
  private readonly moviesApiBase: string;
  private readonly moviesApiTheme: string;
  private readonly vidkingEnabled: boolean;
  private readonly videasyEnabled: boolean;
  private readonly vidsrcEnabled: boolean;
  private readonly moviesApiEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.moviesApiBase = (config.get<string>('MOVIESAPI_BASE_URL') || 'https://moviesapi.to').replace(/\/$/, '');
    this.moviesApiTheme = config.get<string>('MOVIESAPI_THEME') || '8b5cf6';
    this.moviesApiEnabled = config.get<string>('MOVIESAPI_ENABLED') === 'true';
    this.videasyEnabled = config.get<string>('VIDEASY_ENABLED') !== 'false';
    this.vidkingEnabled = config.get<string>('VIDKING_ENABLED') !== 'false';
    this.vidsrcEnabled = config.get<string>('VIDSRC_ENABLED') !== 'false';
  }

  buildMovieEmbedPath(tmdbId: number) {
    return `/api/player/embed/movie/${tmdbId}?theme=${this.moviesApiTheme}`;
  }

  buildTvEmbedPath(tmdbId: number, season: number, episode: number) {
    return `/api/player/embed/tv/${tmdbId}/${season}/${episode}?theme=${this.moviesApiTheme}`;
  }

  buildUpstreamMovieEmbedUrl(tmdbId: number) {
    return `${this.moviesApiBase}/movie/${tmdbId}?theme=${this.moviesApiTheme}`;
  }

  buildUpstreamTvEmbedUrl(tmdbId: number, season: number, episode: number) {
    return `${this.moviesApiBase}/tv/${tmdbId}/${season}/${episode}?theme=${this.moviesApiTheme}`;
  }

  getMovieSources(tmdbId: number): PlaybackSource[] {
    const sources: PlaybackSource[] = [];

    // 1. Primary fast stream: Videasy
    if (this.videasyEnabled) {
      sources.push({
        id: 'videasy',
        name: 'Server 1 (Fast Stream)',
        type: 'embed',
        url: `https://player.videasy.to/movie/${tmdbId}?overlay=true`,
      });
    }

    // 2. Secondary backup: Vidking
    if (this.vidkingEnabled) {
      sources.push({
        id: 'vidking',
        name: 'Server 2 (HD Stream)',
        type: 'embed',
        url: `https://www.vidking.net/embed/movie/${tmdbId}?autoPlay=true`,
      });
    }

    // 3. Resilient fallback: Vidsrc
    if (this.vidsrcEnabled) {
      sources.push({
        id: 'vidsrc',
        name: 'Server 3 (Direct Cloud)',
        type: 'embed',
        url: `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,
      });
    }

    // 4. MoviesAPI if explicitly enabled
    if (this.moviesApiEnabled) {
      sources.push({
        id: 'moviesapi',
        name: 'Server 4 (MoviesAPI)',
        type: 'embed',
        url: this.buildMovieEmbedPath(tmdbId),
      });
    }

    return sources;
  }

  getTvSources(tmdbId: number, season: number, episode: number): PlaybackSource[] {
    const sources: PlaybackSource[] = [];

    // 1. Primary fast stream: Videasy
    if (this.videasyEnabled) {
      sources.push({
        id: 'videasy',
        name: 'Server 1 (Fast Stream)',
        type: 'embed',
        url: `https://player.videasy.to/tv/${tmdbId}/${season}/${episode}?overlay=true`,
      });
    }

    // 2. Secondary backup: Vidking
    if (this.vidkingEnabled) {
      sources.push({
        id: 'vidking',
        name: 'Server 2 (HD Stream)',
        type: 'embed',
        url: `https://www.vidking.net/embed/tv/${tmdbId}/${season}/${episode}?autoPlay=true`,
      });
    }

    // 3. Resilient fallback: Vidsrc
    if (this.vidsrcEnabled) {
      sources.push({
        id: 'vidsrc',
        name: 'Server 3 (Direct Cloud)',
        type: 'embed',
        url: `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`,
      });
    }

    // 4. MoviesAPI if explicitly enabled
    if (this.moviesApiEnabled) {
      sources.push({
        id: 'moviesapi',
        name: 'Server 4 (MoviesAPI)',
        type: 'embed',
        url: this.buildTvEmbedPath(tmdbId, season, episode),
      });
    }

    return sources;
  }
}
