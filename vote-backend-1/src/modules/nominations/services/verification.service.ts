import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../db';
import { NominationWorkflowService } from './nomination-workflow.service';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nominationWorkflow: NominationWorkflowService,
  ) {}

  /**
   * Returns true only when the nomination has exactly 1 VERIFIED NOMINATOR
   * and exactly 2 VERIFIED GUARANTORs. Vacuous `.every()` on zero entries
   * is explicitly guarded — 0 guarantors always returns false.
   */
  async isNominationVerified(nominationId: string): Promise<boolean> {
    const verifications = await this.prisma.verification.findMany({
      where: { nominationId },
    });

    const nominators = verifications.filter(
      (v) => v.role === 'NOMINATOR' && v.status === 'VERIFIED',
    );
    const guarantors = verifications.filter(
      (v) => v.role === 'GUARANTOR' && v.status === 'VERIFIED',
    );

    return nominators.length === 1 && guarantors.length === 2;
  }

  /**
   * Marks a verification as REPUDIATED (fabricated endorser) and delegates
   * to NominationWorkflowService to transition the nomination to NEEDS_ATTENTION
   * and escalate if ≥2 repudiations exist on the nomination.
   */
  async repudiate(verificationId: string, reason: string): Promise<void> {
    const verification = await this.prisma.verification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new NotFoundException(`Verification ${verificationId} not found`);
    }

    await this.prisma.verification.update({
      where: { id: verificationId },
      data: {
        status: 'REPUDIATED',
        repudiatedAt: new Date(),
        repudiationReason: reason,
      },
    });

    this.logger.warn(
      `Verification ${verificationId} repudiated for nomination ${verification.nominationId}: ${reason}`,
    );

    await this.nominationWorkflow.handleRepudiation(verification.nominationId);
  }
}
