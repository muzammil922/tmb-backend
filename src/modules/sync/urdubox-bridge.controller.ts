import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BrowserUrduboxBatchDto } from './dto/browser-urdubox-import.dto';
import { SyncService } from './sync.service';

@ApiTags('sync-bridge')
@Controller('sync/urdubox/bridge')
export class UrduboxBridgeController {
  constructor(private readonly syncService: SyncService) {}

  @Post('batch')
  async bridgeBatch(@Body() body: BrowserUrduboxBatchDto, @Headers('x-bridge-token') bridgeToken?: string) {
    if (!bridgeToken || !(await this.syncService.validateBridgeToken(bridgeToken, body.jobId))) {
      throw new UnauthorizedException('Invalid or expired bridge token');
    }
    return this.syncService.browserImportUrduboxBatch(body.jobId, body.items ?? [], body.finalize ?? false);
  }
}
