import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthEventsListener } from './auth-events.listener';
import { HttpLoggingInterceptor } from './http-logging.interceptor';

@Module({
  providers: [
    AuthEventsListener,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
  ],
})
export class MonitoringModule {}
