import { Module } from '@nestjs/common';
import { SyncModule } from '../../sync/sync.module';
import { AdminAutomationController } from './admin-automation.controller';
import { AdminAutomationService } from './admin-automation.service';

@Module({
  imports: [SyncModule],
  controllers: [AdminAutomationController],
  providers: [AdminAutomationService],
})
export class AdminAutomationModule {}
