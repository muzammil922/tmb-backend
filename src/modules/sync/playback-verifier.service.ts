import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ContentType, PlaybackMode, PlaybackStatus } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { AllMangaClient } from './clients/allmanga.client';
import { MoviesApiClient } from './clients/movies-api.client';
import { isAnimeContent } from './helpers/anime.helper';

export interface VerifyInput {
  contentType: ContentType;
  tmdbId?: number | null;
  title: string;
  language?: string | null;
  genres?: { id: number }[];
  playbackMode?: PlaybackMode | null;
  videoUrl?: string | null;
}

@Injectable()
export class PlaybackVerifierService {
  private readonly logger = new Logger(PlaybackVerifierService.name);

  constructor(
    private readonly http: HttpService,
    private readonly moviesApi: MoviesApiClient,
    private readonly allManga: AllMangaClient,
  ) {}

  async verify(input: VerifyInput): Promise<PlaybackStatus> {
    try {
      if (input.playbackMode === PlaybackMode.HOSTED && input.videoUrl) {
        return await this.verifyHostedUrl(input.videoUrl);
      }

      const isAnime =
        input.contentType === ContentType.ANIME ||
        isAnimeContent({
          original_language: input.language,
          genres: input.genres,
          contentType: input.contentType,
        });

      if (isAnime && this.allManga.isEnabled()) {
        const result = await this.allManga.resolveEpisode({
          title: input.title,
          seasonNumber: 1,
          episodeNumber: 1,
          isMovie: input.contentType === ContentType.MOVIE,
          dub: false,
        });
        return result.ok && result.url ? PlaybackStatus.WORKING : PlaybackStatus.BROKEN;
      }

      if (input.tmdbId) {
        return await this.verifyEmbedAvailability(input.tmdbId, input.contentType);
      }

      return PlaybackStatus.BROKEN;
    } catch (error) {
      this.logger.warn(`Playback verify failed for "${input.title}": ${error}`);
      return PlaybackStatus.BROKEN;
    }
  }

  private async verifyHostedUrl(url: string): Promise<PlaybackStatus> {
    try {
      const response = await firstValueFrom(
        this.http.head(url, {
          timeout: 10000,
          validateStatus: (s) => s < 500,
        }),
      );
      return response.status >= 200 && response.status < 400
        ? PlaybackStatus.WORKING
        : PlaybackStatus.BROKEN;
    } catch {
      return PlaybackStatus.BROKEN;
    }
  }

  private async verifyEmbedAvailability(tmdbId: number, contentType: ContentType): Promise<PlaybackStatus> {
    if (!this.moviesApi.isEnabled()) {
      return PlaybackStatus.WORKING;
    }

    const path =
      contentType === ContentType.MOVIE
        ? this.moviesApi.buildUpstreamMovieEmbedUrl(tmdbId)
        : this.moviesApi.buildUpstreamTvEmbedUrl(tmdbId, 1, 1);

    try {
      const response = await firstValueFrom(
        this.http.get(path, {
          timeout: 12000,
          maxRedirects: 3,
          validateStatus: (s) => s < 500,
          headers: { Accept: 'text/html,*/*' },
        }),
      );
      if (response.status >= 200 && response.status < 400) {
        const body = String(response.data || '');
        if (body.toLowerCase().includes('not found') || body.toLowerCase().includes('unavailable')) {
          return PlaybackStatus.BROKEN;
        }
        return PlaybackStatus.WORKING;
      }
      return PlaybackStatus.BROKEN;
    } catch {
      return PlaybackStatus.BROKEN;
    }
  }
}
