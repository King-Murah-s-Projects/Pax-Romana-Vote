import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../db';
import { NotificationService } from '../../notifications/notification.service';
import { EcConsensusService } from '../../common/utils/ec-consensus.service';
import { BulkNominationReviewDto, NominationReviewDto } from '../dto/nomination-review.dto';
import { NominationStatus } from '@prisma/client';
import { AdminActions } from '../../common/enums/nomination-status.enum';

@Injectable()
export class NominationReviewService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationService,
        private ecConsensusService: EcConsensusService,
    ) {}

    async reviewNomination(reviewDto: NominationReviewDto, reviewerId: string) {
        const nomination = await this.prisma.nomination.findUnique({
            where: { id: reviewDto.nominationId },
            include: { aspirant: true },
        });

        if (!nomination) {
            throw new BadRequestException('Nomination not found');
        }

        if (nomination.status !== NominationStatus.VERIFIED && nomination.status !== NominationStatus.UNDER_REVIEW) {
            throw new BadRequestException('Nomination not ready for review');
        }

        const canVote = await this.ecConsensusService.canMemberVote(reviewerId, reviewDto.nominationId);
        if (!canVote) {
            throw new BadRequestException('You have already reviewed this nomination');
        }

        const decision = reviewDto.action === AdminActions.APPROVE ? 'APPROVE' : 'REJECT';

        // Atomic: records vote + finalizes nomination if consensus reached
        const consensusResult = await this.ecConsensusService.recordVote(
            reviewerId,
            reviewDto.nominationId,
            decision,
        );

        if (consensusResult.reached) {
            await this.notificationsService.notifyAspirantOfDecision(
                reviewDto.nominationId,
                consensusResult.outcome === 'APPROVED' ? 'APPROVE' : 'REJECT',
            );

            if (consensusResult.outcome === 'APPROVED') {
                await this.createCandidateFromNomination(reviewDto.nominationId);
            }
        }

        await this.notificationsService.notifyEcMembersOfDecision(
            reviewDto.nominationId,
            reviewerId,
            reviewDto.action,
        );

        return {
            message: 'Review submitted successfully',
            consensusStatus: consensusResult,
        };
    }

    async bulkReviewNominations(bulkReviewDto: BulkNominationReviewDto, reviewerId: string) {
        const results = {
            totalProcessed: bulkReviewDto.nominationIds.length,
            successful: 0,
            failed: 0,
            errors: [] as string[],
        };

        for (const nominationId of bulkReviewDto.nominationIds) {
            try {
                await this.reviewNomination(
                    {
                        nominationId,
                        action: bulkReviewDto.action,
                        reason: bulkReviewDto.reason,
                        comments: bulkReviewDto.comments,
                    },
                    reviewerId,
                );
                results.successful++;
            } catch (error) {
                results.failed++;
                results.errors.push(
                    `${nominationId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                );
            }
        }

        return results;
    }

    async getNominationsForReview() {
        return this.prisma.nomination.findMany({
            where: { status: { in: [NominationStatus.VERIFIED, NominationStatus.UNDER_REVIEW] } },
            include: {
                aspirant: { select: { id: true, name: true, phone: true } },
                ecReviews: {
                    select: { reviewerId: true, approved: true, comments: true, createdAt: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    private async createCandidateFromNomination(nominationId: string) {
        const nomination = await this.prisma.nomination.findUnique({
            where: { id: nominationId },
            include: { aspirant: true },
        });

        if (!nomination) return;

        const lastCandidate = await this.prisma.candidate.findFirst({
            orderBy: { candidateNumber: 'desc' },
        });

        const nextCandidateNumber = lastCandidate ? lastCandidate.candidateNumber + 1 : 1;

        await this.prisma.candidate.create({
            data: {
                name: nomination.nomineeName,
                position: nomination.nomineePosition,
                nominationId: nomination.id,
                photoUrl: nomination.photoUrl,
                // @ts-ignore
                photoPublicId: nomination.photoPublicId,
                candidateNumber: nextCandidateNumber,
                isActive: true,
            },
        });
    }
}
