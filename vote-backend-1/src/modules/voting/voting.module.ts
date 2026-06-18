import { Module } from '@nestjs/common';
import { CacheModule } from '../caches/cache.module';
import { DbModule } from '../../../db';
import { VotingController } from './voting.controller';
import { VotingService } from './voting.service';
import { VoteSubmissionService } from './services/vote-submission.service';
import { VotingAdminService } from './services/voting-admin.service';
import { EligibilityService } from './eligibility/eligibility.service';
import { CheckinService } from './checkin/checkin.service';
import { CheckinController } from './checkin/checkin.controller';
import { BallotService } from './ballot/ballot.service';
import { BallotController } from './ballot/ballot.controller';
import { RealTimeModule } from '../real-time/real-time.module';
import { ResultsModule } from '../results/results.module';

@Module({
    imports: [DbModule, CacheModule, RealTimeModule, ResultsModule],
    controllers: [VotingController, CheckinController, BallotController],
    providers: [VotingService, VoteSubmissionService, VotingAdminService, EligibilityService, CheckinService, BallotService],
    exports: [VotingService, VoteSubmissionService, VotingAdminService, EligibilityService, CheckinService, BallotService],
})
export class VotingModule {}
