import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.favoritesService.list(user.id);
  }

  @Post()
  add(@CurrentUser() user: { id: string }, @Body('movieId') movieId: string) {
    return this.favoritesService.add(user.id, movieId);
  }

  @Delete(':movieId')
  remove(@CurrentUser() user: { id: string }, @Param('movieId') movieId: string) {
    return this.favoritesService.remove(user.id, movieId);
  }
}
