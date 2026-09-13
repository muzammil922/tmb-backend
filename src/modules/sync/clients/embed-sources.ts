import { ConfigService } from '@nestjs/config';

export type EmbedSourceId = 'moviesapi' | 'vidking' | 'videasy';

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
  private readonly moviesApiEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.moviesApiBase = (config.get<string>('MOVIESAPI_BASE_URL') || 'https://moviesapi.to').replace(/\/$/, '');
    this.moviesApiTheme = config.get<string>('MOVIESAPI_THEME') || '8b5cf6';
    this.moviesApiEnabled = config.get<string>('MOVIESAPI_ENABLED') === 'true';
    this.vidkingEnabled = config.get<string>('VIDKING_ENABLED') !== 'false';
    this.videasyEnabled = config.get<string>('VIDEASY_ENABLED') !== 'false';
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

    if (this.moviesApiEnabled) {
      sources.push({
        id: 'moviesapi',
        name: 'Server 1 (MoviesAPI)',
        type: 'embed',
        url: this.buildMovieEmbedPath(tmdbId),
      });
    }

    if (this.vidkingEnabled) {
      sources.push({
        id: 'vidking',
        name: 'Server 2 (Vidking)',
        type: 'embed',
        url: `https://www.vidking.net/embed/movie/${tmdbId}?autoPlay=true`,
      });
    }

    if (this.videasyEnabled) {
      sources.push({
        id: 'videasy',
        name: 'Server 3 (Videasy)',
        type: 'embed',
        url: `https://player.videasy.to/movie/${tmdbId}?overlay=true`,
      });
    }

    return sources;
  }

  getTvSources(tmdbId: number, season: number, episode: number): PlaybackSource[] {
    const sources: PlaybackSource[] = [];

    if (this.moviesApiEnabled) {
      sources.push({
        id: 'moviesapi',
        name: 'Server 1 (MoviesAPI)',
        type: 'embed',
        url: this.buildTvEmbedPath(tmdbId, season, episode),
      });
    }

    if (this.vidkingEnabled) {
      sources.push({
        id: 'vidking',
        name: 'Server 2 (Vidking)',
        type: 'embed',
        url: `https://www.vidking.net/embed/tv/${tmdbId}/${season}/${episode}?autoPlay=true`,
      });
    }

    if (this.videasyEnabled) {
      sources.push({
        id: 'videasy',
        name: 'Server 3 (Videasy)',
        type: 'embed',
        url: `https://player.videasy.to/tv/${tmdbId}/${season}/${episode}?overlay=true`,
      });
    }

    return sources;
  }
}
