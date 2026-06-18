import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../db';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(private readonly prisma: PrismaService) {}

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
   * Marks a verification as REPUDIATED (fabricated endorser) and flags the
   * parent nomination as NEEDS_ATTENTION so the aspirant can replace the
   * endorser. Full state-machine transitions are handled by issue #19.
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

    // Stub: trigger NEEDS_ATTENTION on the nomination (full state machine in #19)
    await this.prisma.nomination.update({
      where: { id: verification.nominationId },
      data: { status: 'NEEDS_ATTENTION' },
    });
  }
}
