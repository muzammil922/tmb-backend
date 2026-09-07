import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContentType, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ContentSyncService } from './content-sync.service';
import { SyncService } from './sync.service';
import { UpdateSyncSettingsDto } from './dto/update-sync-settings.dto';
import { RunSyncDto } from './dto/run-sync.dto';
import { PublishOwnDto } from './dto/publish-own.dto';

@ApiTags('admin-sync')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/sync')
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly contentSync: ContentSyncService,
  ) {}

  @Get('settings')
  getSettings() {
    return this.syncService.getSettings();
  }

  @Put('settings')
  updateSettings(@Body() body: UpdateSyncSettingsDto) {
    return this.syncService.updateSettings(body);
  }

  @Post('run')
  runSync(@Body() body: RunSyncDto) {
    return this.syncService.runSync(body.source ?? 'ALL');
  }

  @Get('status')
  getStatus() {
    return this.syncService.getStatus();
  }

  @Post('stop')
  stopSync() {
    return this.syncService.stopSync();
  }

  @Post('stop-automation')
  stopAutomation() {
    return this.syncService.stopAutomation();
  }

  @Get('jobs')
  listJobs(@Query('page') page = '1') {
    return this.syncService.listJobs(Number(page));
  }

  @Get('jobs/:id/logs')
  jobLogs(@Param('id') id: string, @Query('page') page = '1') {
    return this.syncService.getJobLogs(id, Number(page));
  }
}

@ApiTags('admin-content')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/content')
export class ContentController {
  constructor(private readonly contentSync: ContentSyncService) {}

  @Get('check/:tmdbId')
  async check(@Param('tmdbId') tmdbId: string, @Query('type') type: 'movie' | 'series' = 'movie') {
    const contentType = type === 'series' ? ContentType.SERIES : ContentType.MOVIE;
    const decision = await this.contentSync.checkContent(Number(tmdbId), contentType);
    const urdubox = await this.contentSync.checkUrduboxAvailability(Number(tmdbId), contentType);

    return {
      tmdbId: Number(tmdbId),
      contentType,
      ...decision,
      exists: decision.action === 'SKIP',
      urduboxAvailable: urdubox.available,
      availableSources: [
        ...(urdubox.available ? ['URDBOX'] : []),
        'MOVIESAPI',
        'HOSTED',
      ],
    };
  }

  @Post('import/urdubox')
  importUrdubox(
    @Body('tmdbId') tmdbId: number,
    @Body('upstreamId') upstreamId?: string,
    @Body('type') type: 'movie' | 'series' = 'movie',
  ) {
    if (type === 'series') {
      return this.contentSync.importSeriesFromUrdubox(Number(tmdbId), upstreamId);
    }
    return this.contentSync.importMovieFromUrdubox(Number(tmdbId), upstreamId);
  }

  @Post('import/moviesapi')
  importMoviesApi(@Body('tmdbId') tmdbId: number, @Body('type') type: 'movie' | 'series' = 'movie') {
    if (type === 'series') {
      return this.contentSync.importSeriesFromMoviesApi(Number(tmdbId));
    }
    return this.contentSync.importMovieFromMoviesApi(Number(tmdbId));
  }

  @Post(':id/publish/own')
  publishOwn(@Param('id') id: string, @Body() body: PublishOwnDto) {
    if (body.mode === 'hosted') {
      if (!body.videoUrl || !body.videoProvider) {
        throw new BadRequestException('videoUrl and videoProvider required for hosted mode');
      }
      return this.contentSync.publishOwnHosted(id, body.videoUrl, body.videoProvider, body.videoDuration);
    }
    return this.contentSync.publishOwnEmbed(id);
  }
}
