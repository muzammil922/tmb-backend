import { Module } from '@nestjs/common';
import { AdminHomepageController } from './admin-homepage.controller';
import { AdminHomepageService } from './admin-homepage.service';

@Module({
  controllers: [AdminHomepageController],
  providers: [AdminHomepageService],
})
export class AdminHomepageModule {}
