import { forwardRef, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationService } from './notification.service';
import { NotificationTestController } from './notifications.controller';
import { MnotifySmsService } from './service/mnotify-sms.service';
import { EmailService } from './service/email.service';
import { AdminNotificationsService } from './service/admin-notifications.service';
import { DeadlineRemindersService } from './service/deadline-reminders.service';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from '../../../db';
import { CommonModule } from '../common/common.module';

@Module({
    imports: [
        ConfigModule.forRoot({}),
        DbModule,
        EventEmitterModule.forRoot(),
        forwardRef(() => CommonModule),
    ],
    controllers: [NotificationTestController],
    providers: [
        NotificationService,
        MnotifySmsService,
        EmailService,
        AdminNotificationsService,
        DeadlineRemindersService,
    ],
    exports: [
        NotificationService,
        MnotifySmsService,
        EmailService,
        AdminNotificationsService,
        DeadlineRemindersService,
    ],
})
export class NotificationsModule {}
