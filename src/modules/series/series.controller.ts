import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
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
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '24',
  ) {
    return this.seriesService.listSeries({
      category,
      search,
      type,
      status,
      source,
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

  @Patch('bulk/status')
  bulkUpdateStatus(@Body() body: any) {
    return this.seriesService.bulkUpdateStatus(body);
  }

  @Delete('bulk/delete')
  bulkDelete(@Body() body: any) {
    return this.seriesService.bulkDelete(body);
  }

  @Patch(':id')
  updateSeries(@Param('id') id: string, @Body() body: any) {
    return this.seriesService.updateSeries(id, body);
  }

  @Delete(':id')
  deleteSeries(@Param('id') id: string) {
    return this.seriesService.deleteSeries(id);
  }
}

