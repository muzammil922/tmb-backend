import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MoviesService } from './movies.service';

@ApiTags('movies')
@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Get('trending')
  trending(@Query('page') page = '1') {
    return this.moviesService.getList('trending', Number(page));
  }

  @Get('popular')
  popular(@Query('page') page = '1') {
    return this.moviesService.getList('popular', Number(page));
  }

  @Get('top-rated')
  topRated(@Query('page') page = '1') {
    return this.moviesService.getList('top-rated', Number(page));
  }

  @Get('upcoming')
  upcoming(@Query('page') page = '1') {
    return this.moviesService.getList('upcoming', Number(page));
  }

  @Get('now-playing')
  nowPlaying(@Query('page') page = '1') {
    return this.moviesService.getList('now-playing', Number(page));
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
  findOne(@Param('id') id: string) {
    return this.moviesService.findOne(id);
  }
}
