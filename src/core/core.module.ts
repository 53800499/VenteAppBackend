import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { CacheModule } from './cache/cache.module';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './events/events.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    SecurityModule,
    CacheModule,
    EventsModule,
    MonitoringModule,
  ],
  exports: [
    AppConfigModule,
    DatabaseModule,
    SecurityModule,
    CacheModule,
    EventsModule,
    MonitoringModule,
  ],
})
export class CoreModule {}
