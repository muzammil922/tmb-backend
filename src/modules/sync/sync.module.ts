import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { TmdbModule } from '../tmdb/tmdb.module';
import { UrduboxClient } from './clients/urdubox.client';
import { MoviesApiClient } from './clients/movies-api.client';
import { ContentSyncService } from './content-sync.service';
import { SyncService } from './sync.service';
import { SyncSchedulerService } from './sync-scheduler.service';
import { SyncController, ContentController } from './sync.controller';
import { PlayerController, StreamController } from './player.controller';
import { StreamService } from './stream.service';

@Module({
  imports: [HttpModule, ScheduleModule.forRoot(), TmdbModule],
  controllers: [SyncController, ContentController, PlayerController, StreamController],
  providers: [
    UrduboxClient,
    MoviesApiClient,
    ContentSyncService,
    SyncService,
    SyncSchedulerService,
    StreamService,
  ],
  exports: [ContentSyncService, SyncService],
})
export class SyncModule {}
