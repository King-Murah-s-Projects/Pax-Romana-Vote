import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { NominationModule } from './modules/nominations/nomination.module';
import { AdminModule } from './modules/admin/admin.module';
import { FileUploadModule } from './modules/file-upload/file-upload.module';
import { DbModule } from '../db';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { ResultsModule } from './modules/results/results.module';
import { RealTimeModule } from './modules/real-time/real-time.module';
import { CacheModule } from './modules/caches/cache.module';
import { VotingModule } from './modules/voting/voting.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
        ScheduleModule.forRoot(),
        AuthModule,
        UsersModule,
        NotificationsModule,
        NominationModule,
        AdminModule,
        FileUploadModule,
        DbModule,
        CandidatesModule,
        ResultsModule,
        RealTimeModule,
        CacheModule,
        VotingModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
    ],
})
export class AppModule {
    private readonly logger = new Logger(AppModule.name);

    constructor() {
        this.logger.log('AppModule initialized');
    }
}
