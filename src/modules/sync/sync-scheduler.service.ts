import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SyncService } from './sync.service';

@Injectable()
export class SyncSchedulerService {
  private readonly logger = new Logger(SyncSchedulerService.name);

  constructor(private readonly syncService: SyncService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleScheduledSyncTick() {
    try {
      const result = await this.syncService.runScheduledSync();
      if ('skipped' in result && result.skipped) return;
      this.logger.log(`Scheduled sync finished: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error('Scheduled sync failed', error);
    }
  }
}
