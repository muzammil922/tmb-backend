import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MoviesService } from './movies.service';

@ApiTags('movies')
@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Get('trending')
  @Header('Cache-Control', 'public, max-age=120, stale-while-revalidate=600')
  trending(@Query('page') page = '1', @Query('limit') limit = '48') {
    return this.moviesService.getList('trending', Number(page), Number(limit));
  }

  @Get('popular')
  @Header('Cache-Control', 'public, max-age=120, stale-while-revalidate=600')
  popular(@Query('page') page = '1', @Query('limit') limit = '48') {
    return this.moviesService.getList('popular', Number(page), Number(limit));
  }

  @Get('top-rated')
  topRated(@Query('page') page = '1', @Query('limit') limit = '48') {
    return this.moviesService.getList('top-rated', Number(page), Number(limit));
  }

  @Get('upcoming')
  upcoming(@Query('page') page = '1', @Query('limit') limit = '48') {
    return this.moviesService.getList('upcoming', Number(page), Number(limit));
  }

  @Get('now-playing')
  nowPlaying(@Query('page') page = '1', @Query('limit') limit = '48') {
    return this.moviesService.getList('now-playing', Number(page), Number(limit));
  }

  @Get('genre/:genreId')
  byGenre(@Param('genreId') genreId: string, @Query('page') page = '1') {
    return this.moviesService.byGenre(genreId, Number(page));
  }

  @Get(':id/cast')
  cast(@Param('id') id: string) {
    return this.moviesService.getCast(id);
  }

  @Get(':id/videos')
  videos(@Param('id') id: string) {
    return this.moviesService.getVideos(id);
  }

  @Get(':id/similar')
  similar(@Param('id') id: string, @Query('page') page = '1') {
    return this.moviesService.getSimilar(id, Number(page));
  }

  @Get(':id/recommendations')
  recommendations(@Param('id') id: string, @Query('page') page = '1') {
    return this.moviesService.getRecommendations(id, Number(page));
  }

  @Get(':id')
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  findOne(@Param('id') id: string) {
    return this.moviesService.findOne(id);
  }
}
