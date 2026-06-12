import { Injectable, Logger } from "@nestjs/common";
import { VoteCountingService } from "./vote-counting.service";
import { CertificationService } from "./certification.service";
import { ExportOptionsDto } from "../dto/export-options.dto";
import { Candidate_Position } from "@prisma/client/index";
import { ExportFormat } from "../enums/result-status.enum";
import { PositionResult } from "../types/results.types";
import * as PDFDocument from "pdfkit";

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private voteCountingService: VoteCountingService,
    private certificationService: CertificationService,
  ) {}

  /**
   * Export results in specified format
   */
  async exportResults(options: ExportOptionsDto): Promise<Buffer> {
    this.logger.log(`Exporting results in ${options.format} format`);

    const positions = options.positions || Object.values(Candidate_Position);
    const results: PositionResult[] = [];

    for (const position of positions) {
      const result =
        await this.voteCountingService.countVotesForPosition(position);

      // Filter certified only if requested
      if (
        options.certifiedOnly &&
        result.certificationStatus === "NOT_CERTIFIED"
      ) {
        continue;
      }

      results.push(result);
    }

    switch (options.format) {
      case ExportFormat.PDF:
        return this.exportToPDF(results, options);
      case ExportFormat.JSON:
        return this.exportToJSON(results, options);
      case ExportFormat.CSV:
        return this.exportToCSV(results, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export to PDF
   */
  private async exportToPDF(
    results: PositionResult[],
    options: ExportOptionsDto,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc
        .fontSize(20)
        .text("Pax Romana KNUST Election Results", { align: "center" });
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`, {
        align: "center",
      });
      doc.moveDown(2);

      // Results for each position
      for (const result of results) {
        doc
          .fontSize(16)
          .text(`${result.position.replace("_", " ")}`, { underline: true });
        doc.fontSize(12);
        doc.text(`Total Votes: ${result.totalVotes}`);
        doc.text(`Turnout: ${result.turnoutPercentage}%`);
        doc.text(`Status: ${result.status}`);

        if (result.winner) {
          doc.text(
            `Winner: ${result.winner.candidateName} (${result.winner.voteCount} votes, ${result.winner.percentage}%)`,
          );
        }

        doc.moveDown();
        doc.text("Candidates:", { underline: true });

        for (const candidate of result.candidates) {
          doc.text(
            `${candidate.candidateNumber}. ${candidate.candidateName}: ${candidate.voteCount} votes (${candidate.percentage}%)`,
          );
        }

        doc.moveDown(2);
      }

      // Certification info
      if (options.includeAuditTrail) {
        doc.addPage();
        doc.fontSize(16).text("Certification History", { underline: true });
        // Add certification details here
      }

      doc.end();
    });
  }

  /**
   * Export to JSON
   */
  private async exportToJSON(
    results: PositionResult[],
    options: ExportOptionsDto,
  ): Promise<Buffer> {
    const exportData: {
      metadata: {
        exportedAt: Date;
        exportedBy: string;
        format: string;
        options: ExportOptionsDto;
      };
      summary: {
        totalPositions: number;
        certifiedPositions: number;
      };
      results: PositionResult[];
      certificationHistory?: any;
    } = {
      metadata: {
        exportedAt: new Date(),
        exportedBy: "System",
        format: "JSON",
        options,
      },
      summary: {
        totalPositions: results.length,
        certifiedPositions: results.filter(
          (r) => r.certificationStatus === "CERTIFIED_FINAL",
        ).length,
      },
      results,
    };

    if (options.includeAuditTrail) {
      exportData.certificationHistory =
        await this.certificationService.getCertificationHistory();
    }

    return Buffer.from(JSON.stringify(exportData, null, 2));
  }

  /**
   * Export to CSV
   */
  private async exportToCSV(
    results: PositionResult[],
    options: ExportOptionsDto,
  ): Promise<Buffer> {
    const csvRows: string[][] = [];

    // Header
    csvRows.push([
      "Position",
      "Candidate Number",
      "Candidate Name",
      "Vote Count",
      "Percentage",
      "Is Winner",
      "Is Runner Up",
      "Total Position Votes",
      "Position Status",
      "Certification Status",
    ]);

    // Data rows
    for (const result of results) {
      for (const candidate of result.candidates) {
        csvRows.push([
          result.position.replace("_", " "),
          candidate.candidateNumber.toString(),
          candidate.candidateName,
          candidate.voteCount.toString(),
          candidate.percentage.toString(),
          candidate.isWinner ? "Yes" : "No",
          candidate.isRunnerUp ? "Yes" : "No",
          result.totalVotes.toString(),
          result.status,
          result.certificationStatus,
        ]);
      }
    }

    const csvContent = csvRows.map((row) => row.join(",")).join("\n");
    return Buffer.from(csvContent);
  }

  /**
   * Generate official results certificate (PDF)
   */
  async generateOfficialCertificate(): Promise<Buffer> {
    const isFullyCertified =
      await this.certificationService.isElectionFullyCertified();

    if (!isFullyCertified) {
      throw new Error(
        "Cannot generate official certificate - not all positions are certified",
      );
    }

    const allResults = await this.voteCountingService.countAllVotes();
    const certificationHistory =
      await this.certificationService.getCertificationHistory();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Official header
      doc
        .fontSize(24)
        .text("OFFICIAL ELECTION RESULTS CERTIFICATE", { align: "center" });
      doc
        .fontSize(16)
        .text("Pax Romana KNUST Student Elections", { align: "center" });
      doc.moveDown(2);

      // Election details
      doc.fontSize(12);
      doc.text(`Election Date: August 5 - August 10, 2025`);
      doc.text(`Results Certified: ${new Date().toLocaleDateString()}`);
      doc.text(
        `Total Eligible Voters: ${allResults[0]?.totalEligibleVoters || 0}`,
      );
      doc.text(
        `Total Votes Cast: ${allResults.reduce((sum, r) => sum + r.totalVotes, 0)}`,
      );
      doc.moveDown(2);

      // Winners
      doc.fontSize(16).text("ELECTED OFFICIALS", { underline: true });
      doc.fontSize(12);

      for (const result of allResults) {
        if (result.winner) {
          doc.text(
            `${result.position.replace("_", " ")}: ${result.winner.candidateName}`,
          );
          doc.text(
            `  Votes: ${result.winner.voteCount} (${result.winner.percentage}%)`,
          );
          doc.moveDown();
        }
      }

      // Certification signature
      doc.moveDown(3);
      doc.text(
        "This certificate is issued under the authority of the Election Commission.",
      );
      doc.moveDown(2);
      doc.text("_________________________");
      doc.text("EC Chairperson (Super Admin)");
      doc.text(`Date: ${new Date().toLocaleDateString()}`);

      doc.end();
    });
  }
}
