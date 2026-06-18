import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { BallotService } from './ballot.service';
import { CheckinService } from '../checkin/checkin.service';

const makePrisma = () => ({
  candidate: {
    findMany: jest.fn(),
  },
  ballot: {
    createMany: jest.fn(),
  },
  $transaction: jest.fn(),
});

const makeCheckin = () => ({
  isTokenValid: jest.fn(),
  consumeToken: jest.fn(),
});

describe('BallotService', () => {
  let service: BallotService;
  let prisma: ReturnType<typeof makePrisma>;
  let checkin: ReturnType<typeof makeCheckin>;

  beforeEach(() => {
    prisma = makePrisma();
    checkin = makeCheckin();
    service = new BallotService(prisma as any, checkin as any);
  });

  const validSelections = [
    { position: 'PRESIDENT' as any, candidateId: 'cand-1' },
  ];

  it('throws 401 when token is invalid', async () => {
    checkin.isTokenValid.mockReturnValue(false);
    await expect(
      service.cast({ ballotToken: 'bad-token', selections: validSelections }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws 401 when token is expired (isTokenValid returns false)', async () => {
    checkin.isTokenValid.mockReturnValue(false);
    await expect(
      service.cast({ ballotToken: 'expired', selections: validSelections }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws 400 when candidate does not belong to the stated position', async () => {
    checkin.isTokenValid.mockReturnValue(true);
    checkin.consumeToken.mockReturnValue(true);
    // candidateId cand-1 is VICE_PRESIDENT, not PRESIDENT
    prisma.candidate.findMany.mockResolvedValue([
      { id: 'cand-1', position: 'VICE_PRESIDENT' },
    ]);
    await expect(
      service.cast({ ballotToken: 'tok', selections: validSelections }),
    ).rejects.toThrow(BadRequestException);
  });

  it('casts ballots and returns success when token and selections are valid', async () => {
    checkin.isTokenValid.mockReturnValue(true);
    checkin.consumeToken.mockReturnValue(true);
    prisma.candidate.findMany.mockResolvedValue([
      { id: 'cand-1', position: 'PRESIDENT' },
    ]);
    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn(prisma),
    );
    prisma.ballot.createMany.mockResolvedValue({ count: 1 });

    const result = await service.cast({ ballotToken: 'tok', selections: validSelections });
    expect(result).toEqual({ success: true });
    expect(checkin.consumeToken).toHaveBeenCalledWith('tok');
  });

  it('throws 401 when consumeToken fails (race: token used between validate and consume)', async () => {
    checkin.isTokenValid.mockReturnValue(true);
    checkin.consumeToken.mockReturnValue(false); // consumed by concurrent request
    prisma.candidate.findMany.mockResolvedValue([
      { id: 'cand-1', position: 'PRESIDENT' },
    ]);
    await expect(
      service.cast({ ballotToken: 'tok', selections: validSelections }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
