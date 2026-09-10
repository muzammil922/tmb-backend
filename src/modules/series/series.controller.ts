import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SeriesService } from './series.service';

@ApiTags('series')
@Controller('series')
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  @Get()
  listSeries(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('type') type?: 'ALL' | 'SERIES' | 'ANIME',
    @Query('page') page = '1',
    @Query('limit') limit = '24',
  ) {
    return this.seriesService.listSeries({
      category,
      search,
      type,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get(':id')
  getSeries(@Param('id') id: string) {
    return this.seriesService.getSeriesById(id);
  }

  @Get(':id/playback/:season/:episode')
  getEpisodePlayback(
    @Param('id') id: string,
    @Param('season') season: string,
    @Param('episode') episode: string,
  ) {
    return this.seriesService.getEpisodePlayback(id, Number(season), Number(episode));
  }
}
