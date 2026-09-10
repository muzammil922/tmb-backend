import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '../../common/cache/cache.module';
import { TmdbModule } from '../tmdb/tmdb.module';
import { UrduboxClient } from './clients/urdubox.client';
import { MoviesApiClient } from './clients/movies-api.client';
import { Imdb3Client } from './clients/imdb3.client';
import { ContentSyncService } from './content-sync.service';
import { SyncService } from './sync.service';
import { SyncSchedulerService } from './sync-scheduler.service';
import { SyncController, ContentController } from './sync.controller';
import { UrduboxBridgeController } from './urdubox-bridge.controller';
import { PlayerController, StreamController } from './player.controller';
import { StreamService } from './stream.service';

@Module({
  imports: [HttpModule, ScheduleModule.forRoot(), TmdbModule, CacheModule],
  controllers: [SyncController, ContentController, UrduboxBridgeController, PlayerController, StreamController],
  providers: [
    UrduboxClient,
    MoviesApiClient,
    Imdb3Client,
    ContentSyncService,
    SyncService,
    SyncSchedulerService,
    StreamService,
  ],
  exports: [ContentSyncService, SyncService, UrduboxClient, MoviesApiClient, Imdb3Client],
})
export class SyncModule {}
