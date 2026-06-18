import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { NominationStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../../../db';

const TERMINAL_STATES = new Set<NominationStatus>([
  NominationStatus.APPROVED,
  NominationStatus.REJECTED,
  NominationStatus.WITHDRAWN,
]);

const VERIFIABLE_STATES = new Set<NominationStatus>([
  NominationStatus.AWAITING_VERIFICATION,
  NominationStatus.PARTIALLY_VERIFIED,
  NominationStatus.NEEDS_ATTENTION,
]);

// Allowed transitions map — source → set of valid targets
const ALLOWED = new Map<NominationStatus, Set<NominationStatus>>([
  [
    NominationStatus.PENDING,
    new Set([NominationStatus.AWAITING_VERIFICATION, NominationStatus.WITHDRAWN]),
  ],
  [
    NominationStatus.AWAITING_VERIFICATION,
    new Set([
      NominationStatus.PARTIALLY_VERIFIED,
      NominationStatus.VERIFIED,
      NominationStatus.NEEDS_ATTENTION,
      NominationStatus.WITHDRAWN,
    ]),
  ],
  [
    NominationStatus.PARTIALLY_VERIFIED,
    new Set([
      NominationStatus.VERIFIED,
      NominationStatus.NEEDS_ATTENTION,
      NominationStatus.WITHDRAWN,
    ]),
  ],
  [
    NominationStatus.VERIFIED,
    new Set([
      NominationStatus.UNDER_REVIEW,
      NominationStatus.NEEDS_ATTENTION,
      NominationStatus.WITHDRAWN,
    ]),
  ],
  [
    NominationStatus.UNDER_REVIEW,
    new Set([
      NominationStatus.APPROVED,
      NominationStatus.REJECTED,
      NominationStatus.NEEDS_ATTENTION,
      NominationStatus.WITHDRAWN,
    ]),
  ],
  [
    NominationStatus.NEEDS_ATTENTION,
    new Set([
      NominationStatus.AWAITING_VERIFICATION,
      NominationStatus.PARTIALLY_VERIFIED,
      NominationStatus.WITHDRAWN,
    ]),
  ],
]);

const MAX_REPLACEMENTS = 3;

@Injectable()
export class NominationWorkflowService {
  private readonly logger = new Logger(NominationWorkflowService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The single guarded transition function — the only writer of nomination status.
   * Throws BadRequestException for illegal or terminal-state transitions.
   */
  async transition(nominationId: string, to: NominationStatus): Promise<void> {
    const nomination = await this.prisma.nomination.findUnique({ where: { id: nominationId } });

    if (!nomination) {
      throw new BadRequestException(`Nomination ${nominationId} not found`);
    }

    const from = nomination.status as NominationStatus;

    if (TERMINAL_STATES.has(from)) {
      throw new BadRequestException(
        `Nomination is in terminal state ${from} and cannot be transitioned`,
      );
    }

    const allowed = ALLOWED.get(from);
    if (!allowed || !allowed.has(to)) {
      throw new BadRequestException(`Invalid status transition: ${from} → ${to}`);
    }

    await this.prisma.nomination.update({
      where: { id: nominationId },
      data: { status: to },
    });

    this.logger.log(`Nomination ${nominationId}: ${from} → ${to}`);
  }

  /**
   * Enforces the replacement cap (~3 replacements per nomination).
   * Must be called before assigning a new endorser after a decline/repudiation.
   */
  async enforceReplacementCap(nominationId: string): Promise<void> {
    const nomination = await this.prisma.nomination.findUnique({ where: { id: nominationId } });

    if (!nomination) {
      throw new BadRequestException(`Nomination ${nominationId} not found`);
    }

    if ((nomination.replacementCount ?? 0) >= MAX_REPLACEMENTS) {
      throw new UnprocessableEntityException(
        `Nomination ${nominationId} has reached the maximum of ${MAX_REPLACEMENTS} endorser replacements`,
      );
    }
  }

  /**
   * Increments the replacement counter after a new endorser is assigned.
   */
  async incrementReplacementCount(nominationId: string): Promise<void> {
    await this.prisma.nomination.update({
      where: { id: nominationId },
      data: { replacementCount: { increment: 1 } },
    });
  }

  /**
   * Called after a Verification is set to REPUDIATED.
   * Transitions the nomination to NEEDS_ATTENTION and escalates if 2+ repudiations exist.
   */
  async handleRepudiation(nominationId: string): Promise<void> {
    await this.transition(nominationId, NominationStatus.NEEDS_ATTENTION);

    const repudiatedCount = await this.prisma.verification.count({
      where: { nominationId, status: VerificationStatus.REPUDIATED },
    });

    if (repudiatedCount >= 2) {
      await this.prisma.nomination.update({
        where: { id: nominationId },
        data: { repudiationEscalated: true },
      });
      this.logger.warn(
        `Nomination ${nominationId} escalated: ${repudiatedCount} repudiations detected`,
      );
    }
  }

  /**
   * Asserts that a nomination is in a state where verification tokens can be processed.
   * Throws if the nomination is terminal, VERIFIED, or UNDER_REVIEW/APPROVED/REJECTED.
   */
  async assertVerifiable(nominationId: string): Promise<void> {
    const nomination = await this.prisma.nomination.findUnique({ where: { id: nominationId } });

    if (!nomination) {
      throw new BadRequestException(`Nomination ${nominationId} not found`);
    }

    const status = nomination.status as NominationStatus;

    if (!VERIFIABLE_STATES.has(status)) {
      throw new BadRequestException(
        `Nomination is not in a verifiable state (current: ${status})`,
      );
    }
  }

  /**
   * Process a nominator/guarantor verification token.
   * Guards against non-verifiable states before acting.
   */
  async processVerification(
    token: string,
    action: 'CONFIRM' | 'DECLINE',
    reason?: string,
  ): Promise<void> {
    const verificationToken = await this.prisma.verificationToken.findUnique({ where: { token } });

    if (!verificationToken) {
      throw new BadRequestException('Invalid verification token');
    }

    if (verificationToken.used || verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Verification token is invalid or expired');
    }

    const verificationId = verificationToken.verificationId;
    const isGuarantor = verificationToken.verificationType === 'GUARANTOR';

    // Resolve nomination and assert verifiable state before any writes
    let nominationId: string | undefined;
    if (isGuarantor) {
      const gv = await this.prisma.guarantorVerification.findUnique({ where: { id: verificationId } });
      nominationId = gv?.nominationId;
    } else {
      const nv = await this.prisma.nominatorVerification.findUnique({ where: { id: verificationId } });
      nominationId = nv?.nominationId;
    }

    if (!nominationId) {
      throw new BadRequestException('Associated nomination not found');
    }

    await this.assertVerifiable(nominationId);

    const updateData = {
      status: action === 'CONFIRM' ? VerificationStatus.VERIFIED : VerificationStatus.DECLINED,
      comments: reason,
      verifiedAt: action === 'CONFIRM' ? new Date() : null,
      declinedAt: action === 'DECLINE' ? new Date() : null,
    };

    if (isGuarantor) {
      await this.prisma.guarantorVerification.update({ where: { id: verificationId }, data: updateData });
    } else {
      await this.prisma.nominatorVerification.update({ where: { id: verificationId }, data: updateData });
    }

    await this.prisma.verificationToken.update({ where: { token }, data: { used: true } });

    // Re-fetch to check if now fully verified
    const nomination = await this.prisma.nomination.findUnique({
      where: { id: nominationId },
      include: { nominatorVerification: true, guarantorVerifications: true },
    });

    if (!nomination) return;

    const allVerified =
      nomination.nominatorVerification?.status === VerificationStatus.VERIFIED &&
      nomination.guarantorVerifications.length === 2 &&
      nomination.guarantorVerifications.every((g) => g.status === VerificationStatus.VERIFIED);

    if (allVerified && !nomination.repudiationEscalated) {
      await this.transition(nominationId, NominationStatus.VERIFIED);
    } else if (action === 'DECLINE') {
      await this.transition(nominationId, NominationStatus.NEEDS_ATTENTION);
    }
  }
}
