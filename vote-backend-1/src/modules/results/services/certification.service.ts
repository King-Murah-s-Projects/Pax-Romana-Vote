import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { RealTimeService } from "../../real-time/services/real-time.service";
import { PrismaService } from "../../../../db";
import { VoteCountingService } from "./vote-counting.service";
import { CertifyResultsDto } from "../dto/certification.dto";
import { Candidate_Position, UserRole } from "@prisma/client/index";
import { SseEventType } from "../../real-time/enums/sse-event-types.enum";
import { ResultStatus } from "../enums/result-status.enum";

@Injectable()
export class CertificationService {
  private readonly logger = new Logger(CertificationService.name);

  constructor(
    private prisma: PrismaService,
    private voteCountingService: VoteCountingService,
    private sseService: RealTimeService,
  ) {}

  /**
   * Certify election results (Super Admin only)
   */
  async certifyResults(
    certifyDto: CertifyResultsDto,
    certifiedByUserId: string,
  ): Promise<{
    success: boolean;
    certifiedPositions: string[];
    errors: string[];
  }> {
    this.logger.log(
      `Starting result certification by user ${certifiedByUserId}`,
    );

    // Verify user is Super Admin
    const certifyingUser = await this.prisma.user.findUnique({
      where: { id: certifiedByUserId },
    });

    if (!certifyingUser || certifyingUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("Only Super Admin can certify results");
    }

    const certifiedPositions: string[] = [];
    const errors: string[] = [];

    // Process each position
    for (const positionCert of certifyDto.positions) {
      try {
        await this.certifyPosition(
          positionCert.position,
          certifiedByUserId,
          certifyingUser.name,
          positionCert.comments,
        );
        certifiedPositions.push(positionCert.position);

        // Emit SSE event for certification
        this.sseService.broadcast({
          type: SseEventType.RESULT_UPDATE,
          data: {
            position: positionCert.position,
            status: "CERTIFIED",
            certifiedBy: certifyingUser.name,
            certifiedAt: new Date(),
          },
          timestamp: new Date(),
        });
      } catch (error) {
        this.logger.error(`Failed to certify ${positionCert.position}:`, error);
        errors.push(`${positionCert.position}: ${error.message}`);
      }
    }

    // Create overall certification record
    if (certifiedPositions.length > 0) {
      await this.createCertificationRecord(
        certifiedPositions,
        certifiedByUserId,
        certifyDto.overallComments,
      );
    }

    this.logger.log(
      `Certification completed. Success: ${certifiedPositions.length}, Errors: ${errors.length}`,
    );

    return {
      success: certifiedPositions.length > 0,
      certifiedPositions,
      errors,
    };
  }

  /**
   * Certify individual position
   */
  private async certifyPosition(
    position: Candidate_Position,
    certifiedBy: string,
    certifiedByName: string,
    comments?: string,
  ): Promise<void> {
    // Get current results for position
    const positionResult = await this.voteCountingService.countVotesForPosition(
      position,
      false,
    );

    // Validate position can be certified
    if (positionResult.status === ResultStatus.DISPUTED) {
      throw new BadRequestException(
        `Position ${position} has disputed results and cannot be certified`,
      );
    }

    if (positionResult.candidates.length === 0) {
      throw new BadRequestException(`Position ${position} has no candidates`);
    }

    // Check if an unopposed candidate met a threshold
    if (
      positionResult.candidates.length === 1 &&
      !positionResult.unopposedThresholdMet
    ) {
      throw new BadRequestException(
        `Unopposed candidate for ${position} did not meet 50% threshold (${positionResult.candidates[0].percentage}%)`,
      );
    }

    // Create certification record in a database
    await this.prisma.$executeRaw`
      INSERT INTO result_certifications (
        id, position, certified_by, certified_by_name, certification_comments, 
        final_vote_counts, certified_at
      ) VALUES (
        gen_random_uuid()::text, ${position}, ${certifiedBy}, ${certifiedByName}, 
        ${comments || ""}, ${JSON.stringify(positionResult.candidates)}, NOW()
      )
    `;

    // Update candidates with certified status
    for (const candidate of positionResult.candidates) {
      await this.prisma.candidate.update({
        where: { id: candidate.candidateId },
        data: {
          voteCount: candidate.voteCount,
          // You might want to add a 'certified' field to the Candidate model
        },
      });
    }

    this.logger.log(`Position ${position} certified by ${certifiedByName}`);
  }

  /**
   * Create overall certification record
   */
  private async createCertificationRecord(
    certifiedPositions: string[],
    certifiedBy: string,
    overallComments?: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: "CERTIFY_RESULTS",
        entity: "ELECTION_RESULTS",
        entityId: "ELECTION_2025",
        newValues: {
          certifiedPositions,
          overallComments,
          certificationTimestamp: new Date(),
        },
        userId: certifiedBy,
      },
    });
  }

  /**
   * Get certification history
   */
  async getCertificationHistory(): Promise<any[]> {
    // Since we don't have a result_certifications table in your schema,
    // we'll query from audit logs
    const certificationLogs = await this.prisma.auditLog.findMany({
      where: {
        action: "CERTIFY_RESULTS",
        entity: "ELECTION_RESULTS",
      },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return certificationLogs.map((log) => ({
      id: log.id,
      certifiedBy: log.user?.name || "Unknown",
      certifiedByEmail: log.user?.email,
      certifiedAt: log.createdAt,
      certifiedPositions: log.newValues?.["certifiedPositions"] || [],
      comments: log.newValues?.["overallComments"],
    }));
  }

  /**
   * Check if all positions are certified
   */
  async isElectionFullyCertified(): Promise<boolean> {
    const allPositions = Object.values(Candidate_Position);
    const certificationHistory = await this.getCertificationHistory();

    if (certificationHistory.length === 0) return false;

    // Get all certified positions from latest certification
    const latestCertification = certificationHistory[0];
    const certifiedPositions = latestCertification.certifiedPositions || [];

    return allPositions.every((position) =>
      certifiedPositions.includes(position),
    );
  }

  /**
   * Revoke certification (emergency use)
   */
  async revokeCertification(
    position: Candidate_Position,
    revokedBy: string,
    reason: string,
  ): Promise<void> {
    // Verify user is Super Admin
    const revokingUser = await this.prisma.user.findUnique({
      where: { id: revokedBy },
    });

    if (!revokingUser || revokingUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("Only Super Admin can revoke certification");
    }

    // Create audit log for revocation
    await this.prisma.auditLog.create({
      data: {
        action: "REVOKE_CERTIFICATION",
        entity: "ELECTION_RESULTS",
        entityId: position,
        newValues: {
          revokedBy: revokingUser.name,
          reason,
          revokedAt: new Date(),
        },
        userId: revokedBy,
      },
    });

    // Clear results cache
    await this.voteCountingService.clearResultsCache();

    // Emit SSE event
    this.sseService.broadcastToAdmins({
      type: SseEventType.SYSTEM_STATUS,
      data: {
        action: "CERTIFICATION_REVOKED",
        position,
        revokedBy: revokingUser.name,
        reason,
      },
      timestamp: new Date(),
    });

    this.logger.warn(
      `Certification revoked for ${position} by ${revokingUser.name}: ${reason}`,
    );
  }
}
