import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { CacheModule } from './cache/cache.module';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './events/events.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { SecurityModule } from './security/security.module';
import { IdempotencyModule } from './idempotency/idempotency.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    SecurityModule,
    CacheModule,
    EventsModule,
    MonitoringModule,
    IdempotencyModule,
  ],
  exports: [
    AppConfigModule,
    DatabaseModule,
    SecurityModule,
    CacheModule,
    EventsModule,
    MonitoringModule,
    IdempotencyModule,
  ],
})
export class CoreModule {}
