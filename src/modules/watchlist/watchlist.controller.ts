import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WatchlistService } from './watchlist.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('watchlist')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.watchlistService.list(user.id);
  }

  @Post()
  add(@CurrentUser() user: { id: string }, @Body('movieId') movieId: string) {
    return this.watchlistService.add(user.id, movieId);
  }

  @Delete(':movieId')
  remove(@CurrentUser() user: { id: string }, @Param('movieId') movieId: string) {
    return this.watchlistService.remove(user.id, movieId);
  }
}
