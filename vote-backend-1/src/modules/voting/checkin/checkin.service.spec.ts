import { ConflictException, ForbiddenException } from '@nestjs/common';
import { CheckinService } from './checkin.service';
import { EligibilityService } from '../eligibility/eligibility.service';

const makeEligibility = (eligible: boolean) => ({
  isEligible: jest.fn().mockResolvedValue(eligible),
  recordParticipation: jest.fn().mockResolvedValue(undefined),
});

describe('CheckinService', () => {
  it('returns a 64-char hex ballot token for an eligible student', async () => {
    const eligibility = makeEligibility(true);
    const svc = new CheckinService(eligibility as unknown as EligibilityService);

    const result = await svc.checkin({ studentId: 's001', operatorId: 'op1', operatorRole: 'POLL_WORKER', stationIp: '10.0.0.1' });

    expect(result.ballotToken).toMatch(/^[0-9a-f]{64}$/);
    expect(eligibility.recordParticipation).toHaveBeenCalledWith('s001');
  });

  it('token contains no studentId or operatorId', async () => {
    const eligibility = makeEligibility(true);
    const svc = new CheckinService(eligibility as unknown as EligibilityService);

    const { ballotToken } = await svc.checkin({ studentId: 's001', operatorId: 'op-xyz', operatorRole: 'POLL_WORKER', stationIp: '10.0.0.1' });

    expect(ballotToken).not.toContain('s001');
    expect(ballotToken).not.toContain('op-xyz');
  });

  it('throws ConflictException when student already participated', async () => {
    const eligibility = makeEligibility(true);
    (eligibility.recordParticipation as jest.Mock).mockRejectedValue(new ConflictException('already participated'));
    const svc = new CheckinService(eligibility as unknown as EligibilityService);

    await expect(
      svc.checkin({ studentId: 's001', operatorId: 'op1', operatorRole: 'POLL_WORKER', stationIp: '10.0.0.1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws ForbiddenException when not on roster and operator is POLL_WORKER', async () => {
    const eligibility = makeEligibility(false);
    const svc = new CheckinService(eligibility as unknown as EligibilityService);

    await expect(
      svc.checkin({ studentId: 's999', operatorId: 'op1', operatorRole: 'POLL_WORKER', stationIp: '10.0.0.1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('issues ballot token via attestation when EC_MEMBER checks in unlisted student', async () => {
    const eligibility = makeEligibility(false);
    const svc = new CheckinService(eligibility as unknown as EligibilityService);

    const result = await svc.checkin({
      studentId: 's999',
      operatorId: 'ec1',
      operatorRole: 'EC_MEMBER',
      stationIp: '10.0.0.1',
      attestationReason: 'Lost ID, confirmed in person',
    });

    expect(result.ballotToken).toMatch(/^[0-9a-f]{64}$/);
    expect(result.attested).toBe(true);
    expect(eligibility.recordParticipation).toHaveBeenCalledWith('s999');
  });

  it('each checkin issues a unique token', async () => {
    const eligibility = makeEligibility(true);
    const svc = new CheckinService(eligibility as unknown as EligibilityService);

    const a = await svc.checkin({ studentId: 's001', operatorId: 'op1', operatorRole: 'POLL_WORKER', stationIp: '10.0.0.1' });
    (eligibility.recordParticipation as jest.Mock).mockResolvedValue(undefined);
    const b = await svc.checkin({ studentId: 's002', operatorId: 'op1', operatorRole: 'POLL_WORKER', stationIp: '10.0.0.1' });

    expect(a.ballotToken).not.toBe(b.ballotToken);
  });
});
