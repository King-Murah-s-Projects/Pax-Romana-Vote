import { TallyService } from './tally.service';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { Candidate_Position } from '@prisma/client';

const mockPrisma = {
  ballot: { groupBy: jest.fn() },
  participationRecord: { count: jest.fn() },
  candidate: { findMany: jest.fn() },
};

const mockConfig = (votingEnd?: string) => ({
  get: jest.fn((key: string) => (key === 'VOTING_END' ? votingEnd : undefined)),
});

describe('TallyService', () => {
  let service: TallyService;

  const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
  const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // 1 hour from now

  afterEach(() => jest.clearAllMocks());

  describe('computeTally', () => {
    it('throws ForbiddenException when voting window has not closed', async () => {
      service = new TallyService(mockPrisma as any, mockConfig(futureDate) as any);
      await expect(service.computeTally()).rejects.toThrow(ForbiddenException);
    });

    it('allows tally when VOTING_END is in the past', async () => {
      service = new TallyService(mockPrisma as any, mockConfig(pastDate) as any);
      mockPrisma.ballot.groupBy.mockResolvedValue([
        { candidateId: 'c1', position: Candidate_Position.PRESIDENT, _count: { candidateId: 5 } },
        { candidateId: 'c2', position: Candidate_Position.PRESIDENT, _count: { candidateId: 3 } },
      ]);
      mockPrisma.candidate.findMany.mockResolvedValue([
        { id: 'c1', name: 'Alice', position: Candidate_Position.PRESIDENT },
        { id: 'c2', name: 'Bob', position: Candidate_Position.PRESIDENT },
      ]);
      const result = await service.computeTally();
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ candidateId: 'c1', ballotCount: 5 });
      expect(result[1]).toMatchObject({ candidateId: 'c2', ballotCount: 3 });
    });

    it('allows tally when VOTING_END is not set (dev mode)', async () => {
      service = new TallyService(mockPrisma as any, mockConfig(undefined) as any);
      mockPrisma.ballot.groupBy.mockResolvedValue([]);
      mockPrisma.candidate.findMany.mockResolvedValue([]);
      const result = await service.computeTally();
      expect(result).toEqual([]);
    });

    it('is reproducible — two calls return same result', async () => {
      service = new TallyService(mockPrisma as any, mockConfig(pastDate) as any);
      const mockData = [{ candidateId: 'c1', position: Candidate_Position.PRESIDENT, _count: { candidateId: 7 } }];
      mockPrisma.ballot.groupBy.mockResolvedValue(mockData);
      mockPrisma.candidate.findMany.mockResolvedValue([
        { id: 'c1', name: 'Alice', position: Candidate_Position.PRESIDENT },
      ]);
      const r1 = await service.computeTally();
      const r2 = await service.computeTally();
      expect(r1).toEqual(r2);
    });

    it('filters by position when provided', async () => {
      service = new TallyService(mockPrisma as any, mockConfig(pastDate) as any);
      mockPrisma.ballot.groupBy.mockResolvedValue([
        { candidateId: 'c1', position: Candidate_Position.PRESIDENT, _count: { candidateId: 4 } },
      ]);
      mockPrisma.candidate.findMany.mockResolvedValue([
        { id: 'c1', name: 'Alice', position: Candidate_Position.PRESIDENT },
      ]);
      await service.computeTally(Candidate_Position.PRESIDENT);
      expect(mockPrisma.ballot.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { position: Candidate_Position.PRESIDENT } }),
      );
    });
  });

  describe('getTurnout', () => {
    it('returns participationCount from ParticipationRecord', async () => {
      service = new TallyService(mockPrisma as any, mockConfig() as any);
      mockPrisma.participationRecord.count.mockResolvedValue(42);
      const result = await service.getTurnout();
      expect(result).toEqual({ participationCount: 42 });
    });

    it('does not include per-candidate data', async () => {
      service = new TallyService(mockPrisma as any, mockConfig() as any);
      mockPrisma.participationRecord.count.mockResolvedValue(10);
      const result = await service.getTurnout();
      expect(result).not.toHaveProperty('candidates');
      expect(result).not.toHaveProperty('ballotCount');
    });
  });
});
