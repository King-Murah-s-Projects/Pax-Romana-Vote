import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { NominationStatus } from '@prisma/client';
import { NominationWorkflowService } from './nomination-workflow.service';

const VERIFIABLE_STATES = [
  NominationStatus.AWAITING_VERIFICATION,
  NominationStatus.PARTIALLY_VERIFIED,
  NominationStatus.NEEDS_ATTENTION,
];

const makeNomination = (status: NominationStatus, extra: Record<string, unknown> = {}) => ({
  id: 'nom-1',
  status,
  replacementCount: 0,
  repudiationEscalated: false,
  ...extra,
});

const makePrisma = (nomination: ReturnType<typeof makeNomination>) => ({
  nomination: {
    findUnique: jest.fn().mockResolvedValue(nomination),
    update: jest.fn().mockResolvedValue({ ...nomination }),
  },
  verification: {
    count: jest.fn().mockResolvedValue(0),
    findUnique: jest.fn().mockResolvedValue(null),
  },
});

describe('NominationWorkflowService.transition', () => {
  const build = (nomination: ReturnType<typeof makeNomination>) => {
    const prisma = makePrisma(nomination);
    const svc = new NominationWorkflowService(prisma as any);
    return { svc, prisma };
  };

  it('allows PENDING → AWAITING_VERIFICATION', async () => {
    const { svc, prisma } = build(makeNomination(NominationStatus.PENDING));
    await svc.transition('nom-1', NominationStatus.AWAITING_VERIFICATION);
    expect(prisma.nomination.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: NominationStatus.AWAITING_VERIFICATION }) }),
    );
  });

  it('rejects PENDING → APPROVED (illegal transition)', async () => {
    const { svc } = build(makeNomination(NominationStatus.PENDING));
    await expect(svc.transition('nom-1', NominationStatus.APPROVED)).rejects.toThrow(BadRequestException);
  });

  it('rejects APPROVED → UNDER_REVIEW (terminal state)', async () => {
    const { svc } = build(makeNomination(NominationStatus.APPROVED));
    await expect(svc.transition('nom-1', NominationStatus.UNDER_REVIEW)).rejects.toThrow(BadRequestException);
  });

  it('rejects REJECTED → PENDING (terminal state)', async () => {
    const { svc } = build(makeNomination(NominationStatus.REJECTED));
    await expect(svc.transition('nom-1', NominationStatus.PENDING)).rejects.toThrow(BadRequestException);
  });

  it('rejects WITHDRAWN → PENDING (terminal state)', async () => {
    const { svc } = build(makeNomination(NominationStatus.WITHDRAWN));
    await expect(svc.transition('nom-1', NominationStatus.PENDING)).rejects.toThrow(BadRequestException);
  });

  it('allows any non-terminal → NEEDS_ATTENTION', async () => {
    for (const status of [
      NominationStatus.AWAITING_VERIFICATION,
      NominationStatus.PARTIALLY_VERIFIED,
      NominationStatus.VERIFIED,
      NominationStatus.UNDER_REVIEW,
    ]) {
      const { svc } = build(makeNomination(status));
      await expect(svc.transition('nom-1', NominationStatus.NEEDS_ATTENTION)).resolves.not.toThrow();
    }
  });

  it('allows NEEDS_ATTENTION → AWAITING_VERIFICATION (replacement path)', async () => {
    const { svc } = build(makeNomination(NominationStatus.NEEDS_ATTENTION));
    await expect(svc.transition('nom-1', NominationStatus.AWAITING_VERIFICATION)).resolves.not.toThrow();
  });

  it('allows any non-terminal → WITHDRAWN', async () => {
    const { svc } = build(makeNomination(NominationStatus.PARTIALLY_VERIFIED));
    await expect(svc.transition('nom-1', NominationStatus.WITHDRAWN)).resolves.not.toThrow();
  });

  it('throws when nomination not found', async () => {
    const prisma = makePrisma(makeNomination(NominationStatus.PENDING));
    prisma.nomination.findUnique.mockResolvedValue(null);
    const svc = new NominationWorkflowService(prisma as any);
    await expect(svc.transition('nom-1', NominationStatus.AWAITING_VERIFICATION)).rejects.toThrow(BadRequestException);
  });
});

describe('NominationWorkflowService.enforceReplacementCap', () => {
  it('throws UnprocessableEntityException when replacementCount >= 3', async () => {
    const prisma = makePrisma(makeNomination(NominationStatus.NEEDS_ATTENTION, { replacementCount: 3 }));
    const svc = new NominationWorkflowService(prisma as any);
    await expect(svc.enforceReplacementCap('nom-1')).rejects.toThrow(UnprocessableEntityException);
  });

  it('passes when replacementCount < 3', async () => {
    const prisma = makePrisma(makeNomination(NominationStatus.NEEDS_ATTENTION, { replacementCount: 2 }));
    const svc = new NominationWorkflowService(prisma as any);
    await expect(svc.enforceReplacementCap('nom-1')).resolves.not.toThrow();
  });
});

describe('NominationWorkflowService.handleRepudiation', () => {
  it('transitions to NEEDS_ATTENTION and escalates when 2+ repudiations', async () => {
    const nomination = makeNomination(NominationStatus.PARTIALLY_VERIFIED);
    const prisma = makePrisma(nomination);
    prisma.verification.count.mockResolvedValue(2);
    const svc = new NominationWorkflowService(prisma as any);
    await svc.handleRepudiation('nom-1');
    expect(prisma.nomination.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ repudiationEscalated: true }) }),
    );
  });

  it('transitions to NEEDS_ATTENTION without escalation when < 2 repudiations', async () => {
    const nomination = makeNomination(NominationStatus.PARTIALLY_VERIFIED);
    const prisma = makePrisma(nomination);
    prisma.verification.count.mockResolvedValue(1);
    const svc = new NominationWorkflowService(prisma as any);
    await svc.handleRepudiation('nom-1');
    const updateCall = prisma.nomination.update.mock.calls.find(
      (c: any[]) => c[0].data?.status === NominationStatus.NEEDS_ATTENTION,
    );
    expect(updateCall).toBeDefined();
    const escalatedCall = prisma.nomination.update.mock.calls.find(
      (c: any[]) => c[0].data?.repudiationEscalated === true,
    );
    expect(escalatedCall).toBeUndefined();
  });
});

describe('NominationWorkflowService.assertVerifiable', () => {
  it('passes for AWAITING_VERIFICATION', async () => {
    const prisma = makePrisma(makeNomination(NominationStatus.AWAITING_VERIFICATION));
    const svc = new NominationWorkflowService(prisma as any);
    await expect(svc.assertVerifiable('nom-1')).resolves.not.toThrow();
  });

  it('throws for APPROVED (terminal)', async () => {
    const prisma = makePrisma(makeNomination(NominationStatus.APPROVED));
    const svc = new NominationWorkflowService(prisma as any);
    await expect(svc.assertVerifiable('nom-1')).rejects.toThrow(BadRequestException);
  });

  it('throws for VERIFIED (already complete)', async () => {
    const prisma = makePrisma(makeNomination(NominationStatus.VERIFIED));
    const svc = new NominationWorkflowService(prisma as any);
    await expect(svc.assertVerifiable('nom-1')).rejects.toThrow(BadRequestException);
  });
});
