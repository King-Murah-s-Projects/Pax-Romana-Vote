import { ForbiddenException } from '@nestjs/common';
import { EcConsensusGuard } from './ec-consensus.guard';

// Minimal ExecutionContext stub exposing only the HTTP request the guard reads.
const ctx = (request: any): any => ({
  switchToHttp: () => ({ getRequest: () => request }),
});

describe('EcConsensusGuard — fail closed', () => {
  let guard: EcConsensusGuard;
  let canMemberVote: jest.Mock;

  beforeEach(() => {
    canMemberVote = jest.fn().mockResolvedValue(true);
    // (reflector, ecConsensusService) — reflector is unused by the guard.
    guard = new EcConsensusGuard({} as any, { canMemberVote } as any);
  });

  it('denies when there is no authenticated user', async () => {
    await expect(
      guard.canActivate(ctx({ body: { nominationId: 'n1' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(canMemberVote).not.toHaveBeenCalled();
  });

  it('denies when nominationId is missing from the body', async () => {
    await expect(
      guard.canActivate(ctx({ user: { id: 'u1', role: 'EC_MEMBER' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(canMemberVote).not.toHaveBeenCalled();
  });

  it('denies when the reviewer has already voted on this nomination', async () => {
    canMemberVote.mockResolvedValue(false);
    await expect(
      guard.canActivate(
        ctx({ user: { id: 'u1', role: 'EC_MEMBER' }, body: { nominationId: 'n1' } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an authenticated reviewer who has not yet voted', async () => {
    const result = await guard.canActivate(
      ctx({ user: { id: 'u1', role: 'EC_MEMBER' }, body: { nominationId: 'n1' } }),
    );
    expect(result).toBe(true);
    expect(canMemberVote).toHaveBeenCalledWith('u1', 'n1');
  });
});
