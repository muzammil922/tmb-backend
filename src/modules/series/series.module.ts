import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '../../common/cache/cache.module';
import { TmdbModule } from '../tmdb/tmdb.module';
import { SyncModule } from '../sync/sync.module';
import { SeriesService } from './series.service';
import { SeriesController } from './series.controller';

@Module({
  imports: [HttpModule, CacheModule, TmdbModule, SyncModule],
  controllers: [SeriesController],
  providers: [SeriesService],
  exports: [SeriesService],
})
export class SeriesModule {}
