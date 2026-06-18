import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '../caches/cache.module';
import { DbModule } from '../../../db';
import { VotingController } from './voting.controller';
import { VotingService } from './voting.service';
import { OtpService } from './services/otp.service';
import { VoteSubmissionService } from './services/vote-submission.service';
import { VotingAdminService } from './services/voting-admin.service';
import { EligibilityService } from './eligibility/eligibility.service';
import { RealTimeModule } from '../real-time/real-time.module';
import { ResultsModule } from '../results/results.module';

@Module({
    imports: [HttpModule, DbModule, CacheModule, RealTimeModule, ResultsModule],
    controllers: [VotingController],
    providers: [VotingService, OtpService, VoteSubmissionService, VotingAdminService, EligibilityService],
    exports: [VotingService, OtpService, VoteSubmissionService, VotingAdminService, EligibilityService],
})
export class VotingModule {}
