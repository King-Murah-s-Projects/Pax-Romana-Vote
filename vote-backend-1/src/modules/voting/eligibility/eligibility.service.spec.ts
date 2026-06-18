import { ConflictException } from '@nestjs/common';
import { EligibilityService } from './eligibility.service';

const makePrisma = () => ({
  eligibilityRoster: {
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    findUnique: jest.fn().mockResolvedValue(null),
  },
  participationRecord: {
    create: jest.fn().mockResolvedValue({ id: '1', studentId: 'S001', checkedInAt: new Date() }),
  },
});

describe('EligibilityService', () => {
  let service: EligibilityService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new EligibilityService(prisma as any);
  });

  describe('importRoster', () => {
    it('bulk-creates roster entries via createMany', async () => {
      const entries = [
        { studentId: 'S001', name: 'Alice' },
        { studentId: 'S002', name: 'Bob' },
      ];
      await service.importRoster(entries);
      expect(prisma.eligibilityRoster.createMany).toHaveBeenCalledWith({
        data: entries,
        skipDuplicates: true,
      });
    });
  });

  describe('freezeRoster', () => {
    it('marks all unfrozen entries as frozen', async () => {
      await service.freezeRoster();
      expect(prisma.eligibilityRoster.updateMany).toHaveBeenCalledWith({
        where: { frozen: false },
        data: { frozen: true },
      });
    });
  });

  describe('isEligible', () => {
    it('returns true when studentId exists in a frozen roster entry', async () => {
      prisma.eligibilityRoster.findUnique.mockResolvedValue({
        id: '1',
        studentId: 'S001',
        name: 'Alice',
        frozen: true,
      });
      const result = await service.isEligible('S001');
      expect(result).toBe(true);
    });

    it('returns false when studentId is not in roster', async () => {
      prisma.eligibilityRoster.findUnique.mockResolvedValue(null);
      const result = await service.isEligible('S999');
      expect(result).toBe(false);
    });
  });

  describe('recordParticipation', () => {
    it('creates a ParticipationRecord for a valid studentId', async () => {
      await service.recordParticipation('S001');
      expect(prisma.participationRecord.create).toHaveBeenCalledWith({
        data: { studentId: 'S001' },
      });
    });

    it('throws ConflictException when studentId has already participated (P2002)', async () => {
      const prismaUniqueError = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      });
      prisma.participationRecord.create.mockRejectedValue(prismaUniqueError);
      await expect(service.recordParticipation('S001')).rejects.toThrow(ConflictException);
    });

    it('re-throws non-unique errors as-is', async () => {
      const unknownError = new Error('Connection refused');
      prisma.participationRecord.create.mockRejectedValue(unknownError);
      await expect(service.recordParticipation('S001')).rejects.toThrow('Connection refused');
    });
  });
});
