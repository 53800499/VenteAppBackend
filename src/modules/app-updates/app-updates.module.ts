import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AppUpdatesController } from './app-updates.controller';
import { AppUpdatesService } from './app-updates.service';

@Module({
  imports: [CoreModule],
  controllers: [AppUpdatesController],
  providers: [AppUpdatesService],
  exports: [AppUpdatesService],
})
export class AppUpdatesModule {}

