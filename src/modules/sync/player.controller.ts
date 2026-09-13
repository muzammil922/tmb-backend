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
  embedMovie(@Param('tmdbId') tmdbId: string, @Res() res: Response) {
    const upstream = this.player.buildUpstreamMovieEmbedUrl(Number(tmdbId));
    res.setHeader('Content-Type', 'text/html');
    res.send(this.buildEmbedHtml(upstream));
  }

  @Get('embed/tv/:tmdbId/:season/:episode')
  embedTv(
    @Param('tmdbId') tmdbId: string,
    @Param('season') season: string,
    @Param('episode') episode: string,
    @Res() res: Response,
  ) {
    const upstream = this.player.buildUpstreamTvEmbedUrl(Number(tmdbId), Number(season), Number(episode));
    res.setHeader('Content-Type', 'text/html');
    res.send(this.buildEmbedHtml(upstream));
  }

  private buildEmbedHtml(src: string) {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TMB Player</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style>
</head><body><iframe src="${src}" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe></body></html>`;
  }
}
