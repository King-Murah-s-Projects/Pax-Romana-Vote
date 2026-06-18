import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { EligibilityService } from '../eligibility/eligibility.service';

export interface CheckinInput {
  studentId: string;
  operatorId: string;
  operatorRole: 'POLL_WORKER' | 'EC_MEMBER';
  stationIp: string;
  attestationReason?: string;
}

export interface CheckinResult {
  ballotToken: string;
  attested: boolean;
}

interface TokenEntry {
  usedAt: null;
  expiresAt: number;
}

@Injectable()
export class CheckinService {
  private readonly logger = new Logger(CheckinService.name);
  private readonly tokens = new Map<string, TokenEntry>();
  private readonly TTL_MS = 15 * 60 * 1000;

  constructor(private readonly eligibilityService: EligibilityService) {}

  async checkin(input: CheckinInput): Promise<CheckinResult> {
    const { studentId, operatorId, operatorRole, stationIp, attestationReason } = input;
    const eligible = await this.eligibilityService.isEligible(studentId);

    if (!eligible) {
      if (operatorRole !== 'EC_MEMBER') {
        throw new ForbiddenException(
          `Student ${studentId} is not on the eligibility roster. Same-Day Attestation requires an EC_MEMBER.`,
        );
      }
      this.logger.warn(
        `Attestation: studentId=${studentId} operatorId=${operatorId} ip=${stationIp} reason="${attestationReason ?? 'none'}"`,
      );
    }

    await this.eligibilityService.recordParticipation(studentId);

    const ballotToken = randomBytes(32).toString('hex');
    this.tokens.set(ballotToken, { usedAt: null, expiresAt: Date.now() + this.TTL_MS });

    return { ballotToken, attested: !eligible };
  }

  isTokenValid(token: string): boolean {
    const entry = this.tokens.get(token);
    if (!entry) return false;
    if (entry.usedAt !== null) return false;
    if (Date.now() > entry.expiresAt) return false;
    return true;
  }

  consumeToken(token: string): boolean {
    if (!this.isTokenValid(token)) return false;
    this.tokens.delete(token);
    return true;
  }
}
