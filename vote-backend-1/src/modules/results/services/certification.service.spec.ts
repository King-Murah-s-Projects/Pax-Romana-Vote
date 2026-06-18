import { ConflictException } from '@nestjs/common';
import { Candidate_Position } from '@prisma/client';
import { CertificationService } from './certification.service';

const TALLY = [
  { candidateId: 'c1', candidateName: 'Alice', position: Candidate_Position.PRESIDENT, ballotCount: 10 },
  { candidateId: 'c2', candidateName: 'Bob', position: Candidate_Position.PRESIDENT, ballotCount: 7 },
];

const mockTallyService = { computeTally: jest.fn() };

const mockPrisma = {
  resultCertification: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('CertificationService', () => {
  let service: CertificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CertificationService(mockPrisma as any, mockTallyService as any);
  });

  describe('certifyPosition', () => {
    it('snapshots the tally at certification time', async () => {
      mockTallyService.computeTally.mockResolvedValue(TALLY);
      mockPrisma.resultCertification.create.mockResolvedValue({
        id: 'cert1',
        position: Candidate_Position.PRESIDENT,
        certifiedAt: new Date(),
        certifiedById: 'user1',
        tallySnapshot: TALLY,
        notes: null,
      });

      await service.certifyPosition(Candidate_Position.PRESIDENT, 'user1');

      expect(mockPrisma.resultCertification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          position: Candidate_Position.PRESIDENT,
          certifiedById: 'user1',
          tallySnapshot: TALLY,
        }),
      });
    });

    it('throws ConflictException when position already certified', async () => {
      mockTallyService.computeTally.mockResolvedValue(TALLY);
      const err = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      mockPrisma.resultCertification.create.mockRejectedValue(err);

      await expect(
        service.certifyPosition(Candidate_Position.PRESIDENT, 'user1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getCertification', () => {
    it('returns null when position not certified', async () => {
      mockPrisma.resultCertification.findUnique.mockResolvedValue(null);
      const result = await service.getCertification(Candidate_Position.PRESIDENT);
      expect(result).toBeNull();
    });

    it('returns the certification record when found', async () => {
      const cert = { id: 'cert1', position: Candidate_Position.PRESIDENT };
      mockPrisma.resultCertification.findUnique.mockResolvedValue(cert);
      const result = await service.getCertification(Candidate_Position.PRESIDENT);
      expect(result).toEqual(cert);
    });
  });

  describe('listCertifications', () => {
    it('returns all certification records', async () => {
      const certs = [
        { id: 'cert1', position: Candidate_Position.PRESIDENT },
        { id: 'cert2', position: Candidate_Position.VICE_PRESIDENT },
      ];
      mockPrisma.resultCertification.findMany.mockResolvedValue(certs);
      const result = await service.listCertifications();
      expect(result).toHaveLength(2);
      expect(result).toEqual(certs);
    });
  });
});
