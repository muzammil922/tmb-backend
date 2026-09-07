import { Module } from '@nestjs/common';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { TmdbModule } from '../tmdb/tmdb.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [TmdbModule, SyncModule],
  controllers: [MoviesController],
  providers: [MoviesService],
  exports: [MoviesService],
})
export class MoviesModule {}
