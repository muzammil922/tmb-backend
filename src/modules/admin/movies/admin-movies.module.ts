import { Module } from '@nestjs/common';
import { AdminMoviesController, AdminTmdbController } from './admin-movies.controller';
import { AdminMoviesService } from './admin-movies.service';
import { TmdbModule } from '../../tmdb/tmdb.module';

@Module({
  imports: [TmdbModule],
  controllers: [AdminMoviesController, AdminTmdbController],
  providers: [AdminMoviesService],
})
export class AdminMoviesModule {}
