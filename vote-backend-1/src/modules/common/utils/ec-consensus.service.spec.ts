import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EcConsensusService } from './ec-consensus.service';
import { PrismaService } from '../../../../db';

const mockPrisma = {
    ecReview: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
    },
    user: { count: jest.fn(), findUnique: jest.fn() },
    nomination: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    chairOverrideLog: { create: jest.fn() },
    $transaction: jest.fn(),
};

function makeReviews(approvals: number, rejections: number) {
    return [
        ...Array(approvals).fill({ approved: true }),
        ...Array(rejections).fill({ approved: false }),
    ];
}

describe('EcConsensusService', () => {
    let service: EcConsensusService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EcConsensusService,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();
        service = module.get<EcConsensusService>(EcConsensusService);
        jest.clearAllMocks();
    });

    describe('computeConsensus', () => {
        it('quorum=3, 2 approvals → reached, outcome=APPROVED', async () => {
            mockPrisma.user.count.mockResolvedValue(3);
            mockPrisma.ecReview.findMany.mockResolvedValue(makeReviews(2, 0));

            const result = await service.computeConsensus('nom1');

            expect(result.reached).toBe(true);
            expect(result.outcome).toBe('APPROVED');
            expect(result.deadlocked).toBe(false);
            expect(result.chairCanOverride).toBe(false);
            expect(result.quorum).toBe(3);
            expect(result.approvals).toBe(2);
        });

        it('quorum=3, 2 rejections → reached, outcome=REJECTED', async () => {
            mockPrisma.user.count.mockResolvedValue(3);
            mockPrisma.ecReview.findMany.mockResolvedValue(makeReviews(0, 2));

            const result = await service.computeConsensus('nom1');

            expect(result.reached).toBe(true);
            expect(result.outcome).toBe('REJECTED');
            expect(result.rejections).toBe(2);
        });

        it('quorum=3, 1 approval + 1 rejection with 1 not voted → not reached, not deadlocked', async () => {
            mockPrisma.user.count.mockResolvedValue(3);
            mockPrisma.ecReview.findMany.mockResolvedValue(makeReviews(1, 1));

            const result = await service.computeConsensus('nom1');

            expect(result.reached).toBe(false);
            expect(result.outcome).toBeNull();
            expect(result.deadlocked).toBe(false);
            expect(result.chairCanOverride).toBe(false);
        });

        it('quorum=2, 1+1 all voted → deadlocked, chairCanOverride=true', async () => {
            mockPrisma.user.count.mockResolvedValue(2);
            mockPrisma.ecReview.findMany.mockResolvedValue(makeReviews(1, 1));

            const result = await service.computeConsensus('nom1');

            expect(result.reached).toBe(false);
            expect(result.deadlocked).toBe(true);
            expect(result.chairCanOverride).toBe(true);
        });

        it('quorum=0 → not reached, not deadlocked', async () => {
            mockPrisma.user.count.mockResolvedValue(0);
            mockPrisma.ecReview.findMany.mockResolvedValue([]);

            const result = await service.computeConsensus('nom1');

            expect(result.reached).toBe(false);
            expect(result.deadlocked).toBe(false);
        });

        it('excludes ADMIN/SUPER_ADMIN from quorum — uses EC_MEMBER only', async () => {
            // If this called count with ADMIN included, quorum would be higher.
            // We verify by checking the Prisma call uses EC_MEMBER only.
            mockPrisma.user.count.mockResolvedValue(3);
            mockPrisma.ecReview.findMany.mockResolvedValue(makeReviews(2, 0));

            await service.computeConsensus('nom1');

            expect(mockPrisma.user.count).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        role: 'EC_MEMBER',
                    }),
                }),
            );
        });
    });

    describe('canMemberVote', () => {
        it('returns true when member has not yet voted', async () => {
            mockPrisma.ecReview.findUnique.mockResolvedValue(null);
            expect(await service.canMemberVote('u1', 'nom1')).toBe(true);
        });

        it('returns false when member has already voted', async () => {
            mockPrisma.ecReview.findUnique.mockResolvedValue({ id: 'r1' });
            expect(await service.canMemberVote('u1', 'nom1')).toBe(false);
        });
    });

    describe('recordVote', () => {
        it('creates EcReview row and returns consensus result', async () => {
            mockPrisma.ecReview.create.mockResolvedValue({ id: 'rev1' });
            mockPrisma.user.count.mockResolvedValue(3);
            mockPrisma.ecReview.findMany.mockResolvedValue(makeReviews(1, 0));
            mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<any>) =>
                fn(mockPrisma),
            );

            const result = await service.recordVote('u1', 'nom1', 'APPROVE');

            expect(mockPrisma.ecReview.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ approved: true, reviewerId: 'u1', nominationId: 'nom1' }),
                }),
            );
            expect(result.reached).toBe(false);
        });

        it('finalizes nomination when consensus is reached', async () => {
            mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<any>) =>
                fn(mockPrisma),
            );
            mockPrisma.ecReview.create.mockResolvedValue({ id: 'rev1' });
            mockPrisma.user.count.mockResolvedValue(3);
            mockPrisma.ecReview.findMany.mockResolvedValue(makeReviews(2, 0));
            mockPrisma.nomination.update.mockResolvedValue({ id: 'nom1', status: 'APPROVED' });

            await service.recordVote('u1', 'nom1', 'APPROVE');

            expect(mockPrisma.nomination.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ id: 'nom1' }),
                    data: expect.objectContaining({ status: 'APPROVED' }),
                }),
            );
        });
    });

    describe('applyChairOverride', () => {
        it('applies override and writes log when deadlocked', async () => {
            // Set up deadlock: quorum=2, 1+1
            mockPrisma.user.count.mockResolvedValue(2);
            mockPrisma.ecReview.findMany.mockResolvedValue(makeReviews(1, 1));
            mockPrisma.chairOverrideLog.create.mockResolvedValue({ id: 'log1' });
            mockPrisma.nomination.update.mockResolvedValue({ id: 'nom1' });
            mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<any>) =>
                fn(mockPrisma),
            );

            await service.applyChairOverride('chair1', 'nom1', 'APPROVE', 'tie-break');

            expect(mockPrisma.chairOverrideLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        actorId: 'chair1',
                        nominationId: 'nom1',
                        decision: 'APPROVE',
                        reason: 'tie-break',
                    }),
                }),
            );
            expect(mockPrisma.nomination.update).toHaveBeenCalled();
        });

        it('throws ForbiddenException when consensus already reached', async () => {
            // quorum=3, 2 approvals → already reached
            mockPrisma.user.count.mockResolvedValue(3);
            mockPrisma.ecReview.findMany.mockResolvedValue(makeReviews(2, 0));

            await expect(
                service.applyChairOverride('chair1', 'nom1', 'REJECT', 'override attempt'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('throws ForbiddenException when not deadlocked yet', async () => {
            // quorum=3, 1+1 — neither deadlocked nor reached
            mockPrisma.user.count.mockResolvedValue(3);
            mockPrisma.ecReview.findMany.mockResolvedValue(makeReviews(1, 1));

            await expect(
                service.applyChairOverride('chair1', 'nom1', 'APPROVE', 'premature'),
            ).rejects.toThrow(ForbiddenException);
        });
    });
});
