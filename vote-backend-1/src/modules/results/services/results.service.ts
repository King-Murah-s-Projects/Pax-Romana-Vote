import { Injectable, Logger } from "@nestjs/common";
import { VoteCountingService } from "./vote-counting.service";
import { CertificationService } from "./certification.service";
import { ExportService } from "./export.service";
import { CacheService } from "../../caches/cache.service";
import { RealTimeService } from "../../real-time/services/real-time.service";
import { PositionResult, ResultSummary } from "../types/results.types";
import { Candidate_Position } from "@prisma/client/index";
import { SseEventType } from "../../real-time/enums/sse-event-types.enum";
import { ExportOptionsDto } from "../dto/export-options.dto";
import { ExportFormat } from "../enums/result-status.enum";

@Injectable()
export class ResultsService {
  private readonly logger = new Logger(ResultsService.name);

  constructor(
    private voteCountingService: VoteCountingService,
    private certificationService: CertificationService,
    private exportService: ExportService,
    private sseService: RealTimeService,
    private cacheService: CacheService,
  ) {}

  /**
   * Get complete election results summary
   */
  async getResultsSummary(useCache = true): Promise<ResultSummary> {
    const cacheKey = "all_results_summary";

    if (useCache) {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return cached as ResultSummary;
      }
    }

    this.logger.log("Generating complete results summary");

    const positionResults = await this.voteCountingService.countAllVotes();

    const summary: ResultSummary = {
      totalPositions: positionResults.length,
      certifiedPositions: positionResults.filter(
        (r) => r.certificationStatus === "CERTIFIED_FINAL",
      ).length,
      pendingPositions: positionResults.filter(
        (r) => r.certificationStatus === "NOT_CERTIFIED",
      ).length,
      totalVotesCast: positionResults.reduce((sum, r) => sum + r.totalVotes, 0),
      totalEligibleVoters: positionResults[0]?.totalEligibleVoters || 0,
      overallTurnout: 0, // Will calculate below
      positionResults,
      lastUpdated: new Date(),
      electionComplete:
        await this.certificationService.isElectionFullyCertified(),
    };

    // Calculate overall turnout
    if (summary.totalEligibleVoters > 0) {
      summary.overallTurnout =
        Math.round(
          (summary.totalVotesCast / summary.totalEligibleVoters) * 100 * 100,
        ) / 100;
    }

    // Cache for 2 minutes
    await this.cacheService.set(cacheKey, summary, 120);

    return summary;
  }

  /**
   * Get results for specific position
   */
  async getPositionResults(
    position: Candidate_Position,
  ): Promise<PositionResult> {
    return this.voteCountingService.countVotesForPosition(position);
  }

  /**
   * Export results in specified format
   */
  async exportResults(options: ExportOptionsDto): Promise<Buffer> {
    this.logger.log(
      `Exporting results in ${options.format} format via ResultsService`,
    );
    return this.exportService.exportResults(options);
  }

  /**
   * Export results as PDF
   */
  async exportResultsAsPDF(
    positions?: Candidate_Position[],
    certifiedOnly = false,
    includeAuditTrail = false,
  ): Promise<Buffer> {
    const exportOptions: ExportOptionsDto = {
      format: ExportFormat.PDF,
      positions,
      certifiedOnly,
      includeAuditTrail,
    };

    return this.exportService.exportResults(exportOptions);
  }

  /**
   * Export results as JSON
   */
  async exportResultsAsJSON(
    positions?: Candidate_Position[],
    certifiedOnly = false,
    includeAuditTrail = false,
  ): Promise<Buffer> {
    const exportOptions: ExportOptionsDto = {
      format: ExportFormat.JSON,
      positions,
      certifiedOnly,
      includeAuditTrail,
    };

    return this.exportService.exportResults(exportOptions);
  }

  /**
   * Export results as CSV
   */
  async exportResultsAsCSV(
    positions?: Candidate_Position[],
    certifiedOnly = false,
    includeAuditTrail = false,
  ): Promise<Buffer> {
    const exportOptions: ExportOptionsDto = {
      format: ExportFormat.CSV,
      positions,
      certifiedOnly,
      includeAuditTrail,
    };

    return this.exportService.exportResults(exportOptions);
  }

  /**
   * Generate official certificate
   */
  async generateOfficialCertificate(): Promise<Buffer> {
    this.logger.log("Generating official election certificate");
    return this.exportService.generateOfficialCertificate();
  }

  /**
   * Export certified results only
   */
  async exportCertifiedResults(format: ExportFormat): Promise<Buffer> {
    const exportOptions: ExportOptionsDto = {
      format,
      certifiedOnly: true,
      includeAuditTrail: true,
    };

    this.logger.log(`Exporting certified results in ${format} format`);
    return this.exportService.exportResults(exportOptions);
  }

  /**
   * Trigger results update and broadcast via SSE
   */
  async updateAndBroadcastResults(): Promise<void> {
    this.logger.log("Updating and broadcasting results");

    // Clear cache to force fresh calculation
    await this.voteCountingService.clearResultsCache();
    await this.cacheService.del("all_results_summary");

    // Get updated results
    const summary = await this.getResultsSummary(false);

    // Broadcast to all connected clients
    this.sseService.broadcast({
      type: SseEventType.RESULT_UPDATE,
      data: {
        summary: {
          totalVotesCast: summary.totalVotesCast,
          overallTurnout: summary.overallTurnout,
          certifiedPositions: summary.certifiedPositions,
          lastUpdated: summary.lastUpdated,
        },
        positions: summary.positionResults.map((p) => ({
          position: p.position,
          totalVotes: p.totalVotes,
          winner: p.winner
            ? {
                name: p.winner.candidateName,
                voteCount: p.winner.voteCount,
                percentage: p.winner.percentage,
              }
            : null,
          status: p.status,
          certificationStatus: p.certificationStatus,
        })),
      },
      timestamp: new Date(),
    });

    this.logger.log("Results updated and broadcasted");
  }

  /**
   * Get public results (filtered for public consumption)
   */
  async getPublicResults(): Promise<any> {
    const summary = await this.getResultsSummary();

    // Filter sensitive information for public view
    return {
      totalVotesCast: summary.totalVotesCast,
      overallTurnout: summary.overallTurnout,
      electionComplete: summary.electionComplete,
      positions: summary.positionResults.map((position) => ({
        position: position.position,
        totalVotes: position.totalVotes,
        candidateCount: position.candidates.length,
        winner:
          position.winner && position.certificationStatus === "CERTIFIED_FINAL"
            ? {
                name: position.winner.candidateName,
                voteCount: position.winner.voteCount,
                percentage: position.winner.percentage,
              }
            : null,
        status: position.status,
        certified: position.certificationStatus === "CERTIFIED_FINAL",
      })),
      lastUpdated: summary.lastUpdated,
    };
  }

  /**
   * Get detailed admin results
   */
  async getAdminResults(): Promise<ResultSummary> {
    return this.getResultsSummary();
  }

  /**
   * Recount votes for specific position
   */
  async recountPosition(
    position: Candidate_Position,
    triggeredBy: string,
  ): Promise<PositionResult> {
    this.logger.log(`Recount triggered for ${position} by user ${triggeredBy}`);

    // Clear cache for this position
    await this.cacheService.del(`position_results:${position}`);

    // Recount with fresh data
    const result = await this.voteCountingService.countVotesForPosition(
      position,
      false,
    );

    // Create audit log
    await this.logRecountAction(position, triggeredBy, result);

    // Broadcast update
    this.sseService.broadcastToAdmins({
      type: SseEventType.RESULT_UPDATE,
      data: {
        action: "RECOUNT_COMPLETED",
        position,
        triggeredBy,
        result: {
          totalVotes: result.totalVotes,
          winner: result.winner,
          candidates: result.candidates,
        },
      },
      timestamp: new Date(),
    });

    return result;
  }

  /**
   * Log recount action for audit
   */
  private async logRecountAction(
    position: Candidate_Position,
    triggeredBy: string,
    result: PositionResult,
  ): Promise<void> {
    // This would typically go to your audit log table
    this.logger.log(
      `Recount completed for ${position} by ${triggeredBy}. New total: ${result.totalVotes} votes`,
    );
  }

  /**
   * Get winner announcements (for display)
   */
  async getWinnerAnnouncements(): Promise<any[]> {
    const summary = await this.getResultsSummary();
    const announcements = [];

    for (const position of summary.positionResults) {
      if (
        position.winner &&
        position.certificationStatus === "CERTIFIED_FINAL"
      ) {
        // @ts-ignore
        announcements.push({
          position: position.position,
          winner: {
            name: position.winner.candidateName,
            candidateNumber: position.winner.candidateNumber,
            voteCount: position.winner.voteCount,
            percentage: position.winner.percentage,
          },
          isUnopposed: position.winner.isUnopposed,
          certifiedAt: (position as any).certifiedAt,
        });
      }
    }

    return announcements;
  }

  /**
   * Check for disputed results that need attention
   */
  async getDisputedResults(): Promise<PositionResult[]> {
    const summary = await this.getResultsSummary();

    return summary.positionResults.filter(
      (position) => position.status === "DISPUTED" || position.requiresRunoff,
    );
  }

  /**
   * Generate and cache election statistics
   */
  async generateElectionStatistics(): Promise<any> {
    const summary = await this.getResultsSummary();

    const stats = {
      participation: {
        totalEligibleVoters: summary.totalEligibleVoters,
        totalVotesCast: summary.totalVotesCast,
        overallTurnout: summary.overallTurnout,
        positionTurnouts: summary.positionResults.map((p) => ({
          position: p.position,
          turnout: p.turnoutPercentage,
        })),
      },
      competition: {
        contestedPositions: summary.positionResults.filter(
          (p) => p.candidates.length > 1,
        ).length,
        unopposedPositions: summary.positionResults.filter(
          (p) => p.candidates.length === 1,
        ).length,
        averageCandidatesPerPosition:
          summary.positionResults.reduce(
            (sum, p) => sum + p.candidates.length,
            0,
          ) / summary.positionResults.length,
      },
      results: {
        certifiedPositions: summary.certifiedPositions,
        pendingPositions: summary.pendingPositions,
        disputedPositions: summary.positionResults.filter(
          (p) => p.status === "DISPUTED",
        ).length,
      },
      margins: summary.positionResults
        .map((p) => {
          if (p.candidates.length < 2) return null;
          const margin = p.candidates[0].voteCount - p.candidates[1].voteCount;
          return {
            position: p.position,
            winningMargin: margin,
            marginPercentage:
              p.totalVotes > 0 ? (margin / p.totalVotes) * 100 : 0,
          };
        })
        .filter(Boolean),
    };

    return stats;
  }

  /**
   * Generate results snapshot for archival
   */
  async generateResultsSnapshot(
    format: ExportFormat = ExportFormat.JSON,
  ): Promise<Buffer> {
    this.logger.log("Generating results snapshot for archival");

    const exportOptions: ExportOptionsDto = {
      format,
      certifiedOnly: false, // Include all results for complete snapshot
      includeAuditTrail: true,
    };

    return this.exportService.exportResults(exportOptions);
  }

  /**
   * Export results for specific positions
   */
  async exportPositionResults(
    positions: Candidate_Position[],
    format: ExportFormat = ExportFormat.PDF,
  ): Promise<Buffer> {
    this.logger.log(`Exporting results for positions: ${positions.join(", ")}`);

    const exportOptions: ExportOptionsDto = {
      format,
      positions,
      certifiedOnly: false,
      includeAuditTrail: false,
    };

    return this.exportService.exportResults(exportOptions);
  }
}
