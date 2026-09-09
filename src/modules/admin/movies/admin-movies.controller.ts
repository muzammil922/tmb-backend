import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AdminMoviesService } from './admin-movies.service';

@ApiTags('admin-movies')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/movies')
export class AdminMoviesController {
  constructor(private readonly adminMoviesService: AdminMoviesService) {}

  @Get()
  list(
    @Query('page') page = '1',
    @Query('search') search = '',
    @Query('limit') limit = '50',
  ) {
    return this.adminMoviesService.list(Number(page) || 1, search, Number(limit) || 50);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminMoviesService.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.adminMoviesService.createManual(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.adminMoviesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adminMoviesService.remove(id);
  }

  @Post('import-tmdb')
  importTmdb(@Body('tmdbId') tmdbId: number) {
    return this.adminMoviesService.importFromTmdb(Number(tmdbId));
  }

  @Post(':id/video')
  attachVideo(
    @Param('id') id: string,
    @Body('videoUrl') videoUrl: string,
    @Body('videoProvider') videoProvider: string,
    @Body('videoDuration') videoDuration?: number,
  ) {
    return this.adminMoviesService.attachVideo(id, videoUrl, videoProvider, videoDuration);
  }
}

@ApiTags('admin-tmdb')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/tmdb')
export class AdminTmdbController {
  constructor(private readonly adminMoviesService: AdminMoviesService) {}

  @Get('search')
  search(@Query('q') q = '') {
    return this.adminMoviesService.searchTmdb(q);
  }
}
