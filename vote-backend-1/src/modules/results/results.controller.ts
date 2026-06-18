import {Body, Controller, Get, HttpStatus, Param, ParseEnumPipe, Post, Res, UseGuards} from "@nestjs/common";
import { ResultsService } from "./services/results.service";
import { CertificationService } from "./services/certification.service";
import { VoteCountingService } from "./services/vote-counting.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {RolesGuard} from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import {Candidate_Position, UserRole} from "@prisma/client/index";
import {CertifyResultsDto} from "./dto/certification.dto";
import {CurrentUser} from "../auth/decorators/current-user.decorator";
import {ExportOptionsDto} from "./dto/export-options.dto";
import {ExportFormat} from "./enums/result-status.enum";
import { Response } from 'express';

@Controller('results')
export class ResultsController {
  constructor(
      private resultsService: ResultsService,
      private certificationService: CertificationService,
      private voteCountingService: VoteCountingService,
  ) {}

  /**
   * Get public election results (limited data)
   */
  @Get('public')
  async getPublicResults() {
    return this.resultsService.getPublicResults();
  }

  /**
   * Get complete results summary (admin only)
   */
  @Get('summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
  async getResultsSummary() {
    return this.resultsService.getAdminResults();
  }

  /**
   * Get results for specific position
   */
  @Get('position/:position')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
  async getPositionResults(
      @Param('position', new ParseEnumPipe(Candidate_Position)) position: Candidate_Position
  ) {
    return this.resultsService.getPositionResults(position);
  }

  /**
   * Get winner announcements (certified results only)
   */
  @Get('winners')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
  async getWinnerAnnouncements() {
    return this.resultsService.getWinnerAnnouncements();
  }

  /**
   * Get disputed results requiring attention
   */
  @Get('disputed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
  async getDisputedResults() {
    return this.resultsService.getDisputedResults();
  }

  /**
   * Get election statistics
   */
  @Get('statistics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
  async getElectionStatistics() {
    return this.resultsService.generateElectionStatistics();
  }

  /**
   * Certify election results (Super Admin only)
   */
  @Post('certify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async certifyResults(
      @Body() certifyDto: CertifyResultsDto,
      @CurrentUser() user: any
  ) {
    return this.certificationService.certifyResults(certifyDto, user.id);
  }

  /**
   * Get certification history
   */
  @Get('certifications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
  async getCertificationHistory() {
    return this.certificationService.getCertificationHistory();
  }

  /**
   * Trigger recount for specific position (Super Admin only)
   */
  @Post('recount/:position')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async recountPosition(
      @Param('position', new ParseEnumPipe(Candidate_Position)) position: Candidate_Position,
      @CurrentUser() user: any
  ) {
    return this.resultsService.recountPosition(position, user.id);
  }

  /**
   * Force refresh results cache
   */
  @Post('refresh')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async refreshResults(@CurrentUser() user: any) {
    await this.resultsService.updateAndBroadcastResults();
    return { message: 'Results refreshed and broadcasted successfully' };
  }

  /**
   * Export results in various formats
   */
  @Post('export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
  async exportResults(
      @Body() exportOptions: ExportOptionsDto,
      @Res() res: Response
  ) {
    const buffer = await this.resultsService.exportResults(exportOptions);

    const filename = `election_results_${new Date().toISOString().split('T')[0]}`;
    const contentType = this.getContentType(exportOptions.format);
    const extension = this.getFileExtension(exportOptions.format);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}.${extension}"`,
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  /**
   * Export results as PDF (convenience endpoint)
   */
  @Get('export/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
  async exportResultsAsPDF(@Res() res: Response) {
    const buffer = await this.resultsService.exportResultsAsPDF();

    const filename = `election_results_${new Date().toISOString().split('T')[0]}`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  /**
   * Export results as CSV (convenience endpoint)
   */
  @Get('export/csv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
  async exportResultsAsCSV(@Res() res: Response) {
    const buffer = await this.resultsService.exportResultsAsCSV();

    const filename = `election_results_${new Date().toISOString().split('T')[0]}`;

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  /**
   * Export results as JSON (convenience endpoint)
   */
  @Get('export/json')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
  async exportResultsAsJSON(@Res() res: Response) {
    const buffer = await this.resultsService.exportResultsAsJSON();

    const filename = `election_results_${new Date().toISOString().split('T')[0]}`;

    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}.json"`,
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  /**
   * Export certified results only
   */
  @Get('export/certified/:format')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
  async exportCertifiedResults(
      @Param('format', new ParseEnumPipe(ExportFormat)) format: ExportFormat,
      @Res() res: Response
  ) {
    const buffer = await this.resultsService.exportCertifiedResults(format);

    const filename = `certified_results_${new Date().toISOString().split('T')[0]}`;
    const contentType = this.getContentType(format);
    const extension = this.getFileExtension(format);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}.${extension}"`,
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  /**
   * Export results for specific positions
   */
  @Post('export/positions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
  async exportPositionResults(
      @Body() body: { positions: Candidate_Position[], format?: ExportFormat },
      @Res() res: Response
  ) {
    const format = body.format || ExportFormat.PDF;
    const buffer = await this.resultsService.exportPositionResults(body.positions, format);

    const positionsStr = body.positions.join('_').toLowerCase();
    const filename = `${positionsStr}_results_${new Date().toISOString().split('T')[0]}`;
    const contentType = this.getContentType(format);
    const extension = this.getFileExtension(format);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}.${extension}"`,
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  /**
   * Generate official certificate (Super Admin only)
   */
  @Get('certificate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async generateOfficialCertificate(@Res() res: Response) {
    const buffer = await this.resultsService.generateOfficialCertificate();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="official_election_certificate.pdf"',
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  /**
   * Generate result snapshot for archival
   */
  @Post('snapshot')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async generateResultsSnapshot(
      @Body() body: { format?: ExportFormat },
      @Res() res: Response
  ) {
    const format = body.format || ExportFormat.JSON;
    const buffer = await this.resultsService.generateResultsSnapshot(format);

    const filename = `election_snapshot_${new Date().toISOString().split('T')[0]}`;
    const contentType = this.getContentType(format);
    const extension = this.getFileExtension(format);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}.${extension}"`,
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  /**
   * Update candidate vote counts in database
   */
  @Post('update-counts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async updateCandidateVoteCounts() {
    await this.voteCountingService.updateCandidateVoteCounts();
    return { message: 'Candidate vote counts updated successfully' };
  }

  /**
   * Revoke certification (emergency use)
   */
  @Post('revoke-certification/:position')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async revokeCertification(
      @Param('position', new ParseEnumPipe(Candidate_Position)) position: Candidate_Position,
      @Body('reason') reason: string,
      @CurrentUser() user: any
  ) {
    await this.certificationService.revokeCertification(position, user.id, reason);
    return { message: `Certification revoked for ${position}` };
  }

  /**
   * Helper method to get content type for export
   */
  private getContentType(format: string | ExportFormat): string {
    const formatStr = typeof format === 'string' ? format : String(format);
    switch (formatStr) {
      case ExportFormat.PDF:
      case 'PDF':
        return 'application/pdf';
      case ExportFormat.JSON:
      case 'JSON':
        return 'application/json';
      case ExportFormat.CSV:
      case 'CSV':
        return 'text/csv';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Helper method to get file extension
   */
  private getFileExtension(format: string | ExportFormat): string {
    const formatStr = typeof format === 'string' ? format : String(format);
    switch (formatStr) {
      case ExportFormat.PDF:
      case 'PDF':
        return 'pdf';
      case ExportFormat.JSON:
      case 'JSON':
        return 'json';
      case ExportFormat.CSV:
      case 'CSV':
        return 'csv';
      default:
        return 'bin';
    }
  }
}