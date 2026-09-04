import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HistoryService } from './history.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('history')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.historyService.list(user.id);
  }

  @Get('continue-watching')
  continueWatching(@CurrentUser() user: { id: string }) {
    return this.historyService.continueWatching(user.id);
  }

  @Post()
  updateProgress(
    @CurrentUser() user: { id: string },
    @Body('movieId') movieId: string,
    @Body('progress') progress: number,
  ) {
    return this.historyService.upsert(user.id, movieId, progress);
  }
}
