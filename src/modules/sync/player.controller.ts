import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PlayerService } from './player.service';

@ApiTags('player')
@Controller('player')
export class PlayerController {
  constructor(private readonly player: PlayerService) {}

  @Get('sources/movie/:tmdbId')
  getMovieSources(@Param('tmdbId') tmdbId: string, @Query('anime') anime?: string, @Query('title') title?: string) {
    if (anime === 'true' && title) {
      return this.player.getAnimeMovieSources(Number(tmdbId), title);
    }
    return this.player.getMovieSources(Number(tmdbId));
  }

  @Get('sources/tv/:tmdbId/:season/:episode')
  getTvSources(
    @Param('tmdbId') tmdbId: string,
    @Param('season') season: string,
    @Param('episode') episode: string,
    @Query('anime') anime?: string,
    @Query('title') title?: string,
  ) {
    return this.player.getTvSources(Number(tmdbId), Number(season), Number(episode), {
      isAnime: anime === 'true',
      title,
    });
  }

  @Get('resolve/anime')
  @ApiQuery({ name: 'title', required: true })
  @ApiQuery({ name: 'season', required: false })
  @ApiQuery({ name: 'episode', required: false })
  @ApiQuery({ name: 'isMovie', required: false })
  @ApiQuery({ name: 'dub', required: false })
  resolveAnime(
    @Query('title') title: string,
    @Query('season') season?: string,
    @Query('episode') episode?: string,
    @Query('isMovie') isMovie?: string,
    @Query('dub') dub?: string,
  ) {
    return this.player.resolveAnime({
      title,
      season: season ? Number(season) : 1,
      episode: episode ? Number(episode) : 1,
      isMovie: isMovie === 'true',
      dub: dub === 'true',
    });
  }

  @Get('proxy')
  async proxy(@Query('url') url: string, @Query('referer') referer: string, @Res() res: Response) {
    await this.player.proxyResource(url, referer, res);
  }

  @Get('embed/movie/:tmdbId')
  async embedMovie(@Param('tmdbId') tmdbId: string, @Res() res: Response) {
    const html = await this.player.renderCleanMovieEmbed(Number(tmdbId));
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('embed/tv/:tmdbId/:season/:episode')
  async embedTv(
    @Param('tmdbId') tmdbId: string,
    @Param('season') season: string,
    @Param('episode') episode: string,
    @Res() res: Response,
  ) {
    const html = await this.player.renderCleanTvEmbed(Number(tmdbId), Number(season), Number(episode));
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}
