import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AdminAutomationService } from './admin-automation.service';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { RecheckPlaybackDto } from './dto/recheck-playback.dto';
import { RunFullDto } from './dto/run-full.dto';

@ApiTags('admin-automation')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminAutomationController {
  constructor(private readonly automationService: AdminAutomationService) {}

  @Post('automation/run-full')
  runFull(@Body() body: RunFullDto) {
    return this.automationService.runFull(body);
  }

  @Get('automation/stats')
  getStats() {
    return this.automationService.getStats();
  }

  @Get('content/library')
  getLibrary(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('playbackStatus') playbackStatus?: string,
    @Query('contentType') contentType?: string,
    @Query('syncPreset') syncPreset?: string,
    @Query('contentSource') contentSource?: string,
  ) {
    return this.automationService.getLibrary({
      page: Number(page || 1),
      limit: Number(limit || 24),
      search,
      playbackStatus,
      contentType,
      syncPreset,
      contentSource,
    });
  }

  @Post('content/bulk-delete')
  bulkDelete(@Body() body: BulkDeleteDto) {
    return this.automationService.bulkDelete(body);
  }

  @Post('content/purge-urdubox')
  purgeUrduBox() {
    return this.automationService.purgeUrduBox();
  }

  @Post('content/recheck-playback')
  recheckPlayback(@Body() body: RecheckPlaybackDto) {
    return this.automationService.recheckPlayback(body);
  }
}
