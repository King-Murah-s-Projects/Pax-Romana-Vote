import { VerificationService } from './verification.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

const makeVerification = (role: 'NOMINATOR' | 'GUARANTOR', status: string) => ({
  id: `v-${role}-${status}`,
  role,
  status,
  nominationId: 'nom-1',
  endorserName: 'Test',
  endorserEmail: 'test@example.com',
});

const makePrisma = (verifications: any[] = []) => ({
  verification: {
    findMany: jest.fn().mockResolvedValue(verifications),
    findUnique: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
  },
  nomination: {
    update: jest.fn().mockResolvedValue({}),
  },
});

describe('VerificationService', () => {
  describe('isNominationVerified', () => {
    it('returns false when there are 0 guarantors', async () => {
      const prisma = makePrisma([
        makeVerification('NOMINATOR', 'VERIFIED'),
      ]);
      const svc = new VerificationService(prisma as any);
      expect(await svc.isNominationVerified('nom-1')).toBe(false);
    });

    it('returns false when nominator is verified but only 1 guarantor verified', async () => {
      const prisma = makePrisma([
        makeVerification('NOMINATOR', 'VERIFIED'),
        makeVerification('GUARANTOR', 'VERIFIED'),
      ]);
      const svc = new VerificationService(prisma as any);
      expect(await svc.isNominationVerified('nom-1')).toBe(false);
    });

    it('returns true when exactly 1 nominator + 2 guarantors all VERIFIED', async () => {
      const prisma = makePrisma([
        makeVerification('NOMINATOR', 'VERIFIED'),
        makeVerification('GUARANTOR', 'VERIFIED'),
        { ...makeVerification('GUARANTOR', 'VERIFIED'), id: 'v-GUARANTOR-2' },
      ]);
      const svc = new VerificationService(prisma as any);
      expect(await svc.isNominationVerified('nom-1')).toBe(true);
    });

    it('returns false when one guarantor is DECLINED', async () => {
      const prisma = makePrisma([
        makeVerification('NOMINATOR', 'VERIFIED'),
        makeVerification('GUARANTOR', 'VERIFIED'),
        { ...makeVerification('GUARANTOR', 'DECLINED'), id: 'v-GUARANTOR-declined' },
      ]);
      const svc = new VerificationService(prisma as any);
      expect(await svc.isNominationVerified('nom-1')).toBe(false);
    });

    it('returns false when nominator is not yet verified', async () => {
      const prisma = makePrisma([
        makeVerification('NOMINATOR', 'PENDING'),
        makeVerification('GUARANTOR', 'VERIFIED'),
        { ...makeVerification('GUARANTOR', 'VERIFIED'), id: 'v-GUARANTOR-2' },
      ]);
      const svc = new VerificationService(prisma as any);
      expect(await svc.isNominationVerified('nom-1')).toBe(false);
    });
  });

  describe('repudiate', () => {
    it('sets status to REPUDIATED', async () => {
      const prisma = makePrisma();
      prisma.verification.findUnique = jest.fn().mockResolvedValue(
        makeVerification('GUARANTOR', 'VERIFIED'),
      );
      const svc = new VerificationService(prisma as any);
      await svc.repudiate('v-GUARANTOR-VERIFIED', 'fabricated endorsement');
      expect(prisma.verification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'v-GUARANTOR-VERIFIED' },
          data: expect.objectContaining({ status: 'REPUDIATED' }),
        }),
      );
    });

    it('throws NotFoundException when verification does not exist', async () => {
      const prisma = makePrisma();
      prisma.verification.findUnique = jest.fn().mockResolvedValue(null);
      const svc = new VerificationService(prisma as any);
      await expect(svc.repudiate('missing-id', 'reason')).rejects.toThrow(NotFoundException);
    });

    it('stubs NEEDS_ATTENTION trigger on the nomination', async () => {
      const prisma = makePrisma();
      prisma.verification.findUnique = jest.fn().mockResolvedValue(
        makeVerification('GUARANTOR', 'VERIFIED'),
      );
      const svc = new VerificationService(prisma as any);
      await svc.repudiate('v-GUARANTOR-VERIFIED', 'reason');
      // nomination.update called to flag NEEDS_ATTENTION
      expect(prisma.nomination.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'nom-1' },
          data: expect.objectContaining({ status: 'NEEDS_ATTENTION' }),
        }),
      );
    });
  });
});
