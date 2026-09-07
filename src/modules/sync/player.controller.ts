import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { MoviesApiClient } from './clients/movies-api.client';
import { StreamService } from './stream.service';

@ApiTags('player')
@Controller('player')
export class PlayerController {
  constructor(private readonly moviesApi: MoviesApiClient) {}

  @Get('embed/movie/:tmdbId')
  embedMovie(@Param('tmdbId') tmdbId: string, @Res() res: Response) {
    const upstream = this.moviesApi.buildUpstreamMovieEmbedUrl(Number(tmdbId));
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
    const upstream = this.moviesApi.buildUpstreamTvEmbedUrl(Number(tmdbId), Number(season), Number(episode));
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

@ApiTags('stream')
@Controller('stream')
export class StreamController {
  constructor(private readonly streamService: StreamService) {}

  @Get('movie/:tmdbId')
  getMoviePlayback(@Param('tmdbId') tmdbId: string) {
    return this.streamService.getMoviePlayback(Number(tmdbId));
  }

  @Get('movie/:tmdbId/playlist.m3u8')
  async movieManifest(@Param('tmdbId') tmdbId: string, @Res() res: Response) {
    await this.streamService.serveMovieManifest(Number(tmdbId), res);
  }

  @Get('tv/:tmdbId/:season/:episode')
  getSeriesPlayback(
    @Param('tmdbId') tmdbId: string,
    @Param('season') season: string,
    @Param('episode') episode: string,
  ) {
    return this.streamService.getSeriesPlayback(Number(tmdbId), Number(season), Number(episode));
  }

  @Get('tv/:tmdbId/:season/:episode/playlist.m3u8')
  async episodeManifest(
    @Param('tmdbId') tmdbId: string,
    @Param('season') season: string,
    @Param('episode') episode: string,
    @Res() res: Response,
  ) {
    await this.streamService.serveEpisodeManifest(Number(tmdbId), Number(season), Number(episode), res);
  }

  @Get('proxy/:encoded')
  async proxy(@Param('encoded') encoded: string, @Res() res: Response) {
    await this.streamService.proxyResource(encoded, res);
  }
}
