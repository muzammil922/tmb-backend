import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './common/cache/cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { TmdbModule } from './modules/tmdb/tmdb.module';
import { MoviesModule } from './modules/movies/movies.module';
import { GenresModule } from './modules/genres/genres.module';
import { SearchModule } from './modules/search/search.module';
import { HomepageModule } from './modules/homepage/homepage.module';
import { WatchlistModule } from './modules/watchlist/watchlist.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { HistoryModule } from './modules/history/history.module';
import { AdminDashboardModule } from './modules/admin/dashboard/admin-dashboard.module';
import { AdminMoviesModule } from './modules/admin/movies/admin-movies.module';
import { AdminHomepageModule } from './modules/admin/homepage/admin-homepage.module';
import { AdminBannersModule } from './modules/admin/banners/admin-banners.module';
import { AdminCategoriesModule } from './modules/admin/categories/admin-categories.module';
import { AdminUsersModule } from './modules/admin/users/admin-users.module';
import { AdminAutomationModule } from './modules/admin/automation/admin-automation.module';
import { MediaModule } from './modules/media/media.module';
import { SyncModule } from './modules/sync/sync.module';
import { SeriesModule } from './modules/series/series.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CacheModule,
    AuthModule,
    TmdbModule,
    MoviesModule,
    SeriesModule,
    GenresModule,
    SearchModule,
    HomepageModule,
    WatchlistModule,
    FavoritesModule,
    HistoryModule,
    AdminDashboardModule,
    AdminMoviesModule,
    AdminHomepageModule,
    AdminBannersModule,
    AdminCategoriesModule,
    AdminUsersModule,
    AdminAutomationModule,
    MediaModule,
    SyncModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
