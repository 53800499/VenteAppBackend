import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuthModule } from '../auth/auth.module';
import { ShopsModule } from '../shops/shops.module';
import { UsersModule } from '../users/users.module';
import {
  AckNotificationsUseCase,
  GetNotificationSettingsUseCase,
  GetPendingNotificationsUseCase,
  UpdateNotificationSettingsUseCase,
} from './application/use-cases/notification.use-cases';
import { NotificationRepository } from './domain/repositories/notification.repository';
import { NotificationFeedService } from './domain/services/notification-feed.service';
import { SupabaseNotificationRepository } from './infrastructure/repositories/notification.repository';
import { NotificationsController } from './presentation/controllers/notifications.controller';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    ShopsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [NotificationsController],
  providers: [
    { provide: NotificationRepository, useClass: SupabaseNotificationRepository },
    NotificationFeedService,
    GetNotificationSettingsUseCase,
    UpdateNotificationSettingsUseCase,
    GetPendingNotificationsUseCase,
    AckNotificationsUseCase,
  ],
  exports: [NotificationFeedService],
})
export class NotificationsModule {}
