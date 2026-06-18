import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../db';
import { NominationStatus, UserRole } from '@prisma/client';

export interface ConsensusResult {
    reached: boolean;
    outcome: 'APPROVED' | 'REJECTED' | null;
    deadlocked: boolean;
    chairCanOverride: boolean;
    approvals: number;
    rejections: number;
    quorum: number;
}

@Injectable()
export class EcConsensusService {
    constructor(private prisma: PrismaService) {}

    async canMemberVote(reviewerId: string, nominationId: string): Promise<boolean> {
        const existingReview = await this.prisma.ecReview.findUnique({
            where: { nominationId_reviewerId: { nominationId, reviewerId } },
        });
        return !existingReview;
    }

    async computeConsensus(nominationId: string): Promise<ConsensusResult> {
        const [quorum, reviews] = await Promise.all([
            // Frozen roll: active EC_MEMBER only — ADMIN and SUPER_ADMIN excluded (ADR-0003)
            this.prisma.user.count({ where: { role: UserRole.EC_MEMBER, isActive: true } }),
            this.prisma.ecReview.findMany({ where: { nominationId } }),
        ]);

        const approvals = reviews.filter((r) => r.approved).length;
        const rejections = reviews.filter((r) => !r.approved).length;
        const voted = approvals + rejections;
        const threshold = quorum > 0 ? Math.ceil((quorum * 2) / 3) : Infinity;

        const reached = approvals >= threshold || rejections >= threshold;
        // Deadlocked: all have voted, consensus not reached, neither side can ever win
        const deadlocked = !reached && voted >= quorum && quorum > 0;

        let outcome: 'APPROVED' | 'REJECTED' | null = null;
        if (reached) {
            outcome = approvals >= threshold ? 'APPROVED' : 'REJECTED';
        }

        return { reached, outcome, deadlocked, chairCanOverride: deadlocked, approvals, rejections, quorum };
    }

    async recordVote(
        reviewerId: string,
        nominationId: string,
        decision: 'APPROVE' | 'REJECT',
    ): Promise<ConsensusResult> {
        await this.prisma.$transaction(async (tx) => {
            await (tx as any).ecReview.create({
                data: {
                    nominationId,
                    reviewerId,
                    approved: decision === 'APPROVE',
                },
            });

            // Re-compute after recording this vote
            const [quorum, reviews] = await Promise.all([
                (tx as any).user.count({ where: { role: UserRole.EC_MEMBER, isActive: true } }),
                (tx as any).ecReview.findMany({ where: { nominationId } }),
            ]);

            const approvals = reviews.filter((r: any) => r.approved).length;
            const rejections = reviews.filter((r: any) => !r.approved).length;
            const threshold = quorum > 0 ? Math.ceil((quorum * 2) / 3) : Infinity;
            const reached = approvals >= threshold || rejections >= threshold;

            if (reached) {
                const status = approvals >= threshold ? NominationStatus.APPROVED : NominationStatus.REJECTED;
                // Idempotent: only finalize if still under review
                await (tx as any).nomination.update({
                    where: {
                        id: nominationId,
                        status: { in: [NominationStatus.VERIFIED, NominationStatus.UNDER_REVIEW] },
                    },
                    data: { status, reviewedAt: new Date() },
                });
            }
        });

        return this.computeConsensus(nominationId);
    }

    async applyChairOverride(
        chairId: string,
        nominationId: string,
        decision: 'APPROVE' | 'REJECT',
        reason: string,
    ): Promise<void> {
        const consensus = await this.computeConsensus(nominationId);

        if (consensus.reached) {
            throw new ForbiddenException('Chair override cannot overturn a reached consensus');
        }
        if (!consensus.deadlocked) {
            throw new ForbiddenException('Chair override is only available when the vote is deadlocked');
        }

        const status = decision === 'APPROVE' ? NominationStatus.APPROVED : NominationStatus.REJECTED;

        await this.prisma.$transaction(async (tx) => {
            await (tx as any).chairOverrideLog.create({
                data: { nominationId, actorId: chairId, decision, reason },
            });
            await (tx as any).nomination.update({
                where: { id: nominationId },
                data: { status, reviewedAt: new Date() },
            });
        });
    }

    // Kept for backwards compatibility — delegates to computeConsensus
    async checkConsensus(nominationId: string) {
        const result = await this.computeConsensus(nominationId);
        return {
            nominationId,
            approvals: result.approvals,
            rejections: result.rejections,
            pending: Math.max(0, result.quorum - result.approvals - result.rejections),
            totalEcMembers: result.quorum,
            requiredForConsensus: result.quorum > 0 ? Math.ceil((result.quorum * 2) / 3) : 0,
            isConsensusReached: result.reached,
            finalDecision: result.outcome === 'APPROVED' ? 'APPROVE' : result.outcome === 'REJECTED' ? 'REJECT' : null,
        };
    }

    async getAllConsensusStatuses() {
        const nominations = await this.prisma.nomination.findMany({
            where: { status: NominationStatus.VERIFIED },
            select: {
                id: true,
                nomineePosition: true,
                nomineeName: true,
                // @ts-ignore — aspirant relation exists at runtime
                aspirant: { select: { name: true } },
            },
        });

        return Promise.all(
            nominations.map(async (nomination) => {
                const consensus = await this.checkConsensus(nomination.id);
                return {
                    ...consensus,
                    position: nomination.nomineePosition,
                    // @ts-ignore
                    aspirantName: nomination.aspirant.name,
                    nomineeName: nomination.nomineeName,
                };
            }),
        );
    }
}
