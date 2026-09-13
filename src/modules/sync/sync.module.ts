import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '../../common/cache/cache.module';
import { TmdbModule } from '../tmdb/tmdb.module';
import { MoviesApiClient } from './clients/movies-api.client';
import { AllMangaClient } from './clients/allmanga.client';
import { Imdb3Client } from './clients/imdb3.client';
import { ContentSyncService } from './content-sync.service';
import { PlaybackVerifierService } from './playback-verifier.service';
import { SyncService } from './sync.service';
import { SyncSchedulerService } from './sync-scheduler.service';
import { SyncController, ContentController } from './sync.controller';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';

@Module({
  imports: [HttpModule, ScheduleModule.forRoot(), TmdbModule, CacheModule],
  controllers: [SyncController, ContentController, PlayerController],
  providers: [
    MoviesApiClient,
    AllMangaClient,
    Imdb3Client,
    ContentSyncService,
    PlaybackVerifierService,
    SyncService,
    SyncSchedulerService,
    PlayerService,
  ],
  exports: [ContentSyncService, SyncService, MoviesApiClient, AllMangaClient, Imdb3Client, PlayerService],
})
export class SyncModule {}
