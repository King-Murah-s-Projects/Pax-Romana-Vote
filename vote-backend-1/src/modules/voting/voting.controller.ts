import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Logger,
    Param,
    Post,
    Put,
    Query,
    UseGuards
} from "@nestjs/common";
import {VotingService} from "./voting.service";
import { VoteSubmissionService } from './services/vote-submission.service';
import { VotingAdminService } from './services/voting-admin.service';
import {SubmitVoteDto} from "./dto/submit-vote.dto";
import {Candidate_Position, UserRole} from "@prisma/client/index";
import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";
import {RolesGuard} from "../auth/guards/roles.guard";
import {Roles} from "../auth/decorators/roles.decorator";
import {CurrentUser} from "../auth/decorators/current-user.decorator";
import {SseEventType} from "../real-time/enums/sse-event-types.enum";

@Controller('voting')
export class VotingController {
    private readonly logger = new Logger(VotingController.name);

    constructor(
        private readonly votingService: VotingService,
        private readonly voteSubmissionService: VoteSubmissionService,
        private readonly votingAdminService: VotingAdminService,
    ) {}

    @Get('ballot')
    async getBallot() {
        this.logger.debug('Ballot requested');
        return this.voteSubmissionService.getBallot();
    }

    @Post('submit')
    async submitVote(@Body() dto: SubmitVoteDto) {
        if (!dto.sessionId || !dto.votes) {
            throw new BadRequestException('Session ID and votes are required');
        }

        this.logger.log(`Vote submission for session: ${dto.sessionId.slice(0, 8)}***`);
        const result = await this.voteSubmissionService.submitVote(dto);

        this.logger.log(`Vote successfully submitted - ID: ${result.voteId}`);
        return result;
    }

    @Get('session/:sessionId/validate')
    async validateSession(@Param('sessionId') sessionId: string) {
        this.logger.debug(`Session validation requested: ${sessionId.slice(0, 8)}***`);
        return this.voteSubmissionService.validateSession(sessionId);
    }

    @Get('stats')
    async getVotingStats() {
        this.logger.debug('Voting statistics requested');
        return this.votingService.getVotingStats();
    }

    // ========== NEW REAL-TIME ENDPOINTS ==========

    /**
     * Get real-time voting progress (public endpoint)
     */
    @Get('progress')
    async getVotingProgress() {
        this.logger.debug('Real-time voting progress requested');
        return this.votingService.getVotingStats();
    }

    /**
     * Get position-specific statistics
     */
    @Get('position/:position/stats')
    async getPositionStats(@Param('position') position: string) {
        // Validate position enum
        if (!Object.values(Candidate_Position).includes(position as Candidate_Position)) {
            throw new BadRequestException('Invalid position');
        }

        this.logger.debug(`Position stats requested for: ${position}`);
        // You'll need to add this method to your voting service
        return this.votingService.getPositionStats(position as Candidate_Position);
    }

    /**
     * Get real-time connection information (Admin only)
     */
    @Get('realtime/connections')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
    async getRealtimeConnections(@CurrentUser() user: any) {
        this.logger.log(`Real-time connection info requested by: ${user.email}`);
        return this.votingService.getRealtimeConnectionInfo();
    }

    /**
     * Manually refresh statistics and broadcast (Admin only)
     */
    @Post('stats/refresh')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
    async refreshStats(@CurrentUser() user: any) {
        this.logger.log(`Manual stats refresh triggered by: ${user.email}`);
        await this.votingService.refreshAndBroadcastStats();

        return {
            message: 'Statistics refreshed and broadcasted successfully',
            triggeredBy: user.email,
            timestamp: new Date(),
        };
    }

    /**
     * Broadcast a custom message to a specific role (Super Admin only)
     */
    @Post('broadcast')
    @UseGuards(JwtAuthGuard, RolesGuard)
    
    @Roles(UserRole.SUPER_ADMIN)
    async broadcastMessage(
        @Body() body: { message: string; role: UserRole; eventType?: SseEventType },
        @CurrentUser() user: any,
    ) {
        const { message, role, eventType = SseEventType.SYSTEM_STATUS } = body;

        if (!message || !role) {
            throw new BadRequestException('Message and role are required');
        }

        if (!Object.values(UserRole).includes(role)) {
            throw new BadRequestException('Invalid role specified');
        }

        this.logger.log(`Broadcasting message to ${role} by: ${user.email}`);
        await this.votingService.broadcastMessage(message, role, eventType);

        return {
            message: 'Message broadcasted successfully',
            targetRole: role,
            broadcastedBy: user.email,
            timestamp: new Date(),
        };
    }

    /**
     * Get voting velocity data (Admin only)
     */
    @Get('velocity')
    @UseGuards(JwtAuthGuard, RolesGuard)
    
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
    async getVotingVelocity(@CurrentUser() user: any) {
        this.logger.debug(`Voting velocity requested by: ${user.email}`);
        // You'll need to add this method to your voting service
        return this.votingService.getVotingVelocity();
    }

    /**
     * Get detailed voting analytics (Admin only)
     */
    @Get('analytics')
    @UseGuards(JwtAuthGuard, RolesGuard)
    
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
    async getVotingAnalytics(
        @CurrentUser() user: any,
        @Query('timeframe') timeframe?: string, // 'hour', 'day', 'all'
        @Query('position') position?: string,
    ) {
        this.logger.log(`Voting analytics requested by: ${user.email}`);

        return this.votingAdminService.getVotingAnalytics({
            timeframe: timeframe || 'all',
            position: position as Candidate_Position,
            requestedBy: user.email,
        });
    }

    /**
     * Check system health (Admin only)
     */
    @Get('health')
    @UseGuards(JwtAuthGuard, RolesGuard)
    
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
    async getSystemHealth(@CurrentUser() user: any) {
        this.logger.debug(`System health check by: ${user.email}`);
        return this.votingAdminService.getSystemHealth();
    }

    /**
     * Get anomaly detection results (Super Admin only)
     */
    @Get('anomalies')
    @UseGuards(JwtAuthGuard, RolesGuard)
    
    @Roles(UserRole.SUPER_ADMIN)
    async getAnomalies(@CurrentUser() user: any) {
        this.logger.log(`Anomaly detection results requested by: ${user.email}`);
        return this.votingAdminService.getAnomalies();
    }

    /**
     * Emergency: Pause voting (Super Admin only)
     */
    @Put('emergency/pause')
    @UseGuards(JwtAuthGuard, RolesGuard)
    
    @Roles(UserRole.SUPER_ADMIN)
    async pauseVoting(
        @Body() body: { reason: string },
        @CurrentUser() user: any,
    ) {
        const { reason } = body;

        if (!reason) {
            throw new BadRequestException('Reason for pausing is required');
        }

        this.logger.warn(`EMERGENCY: Voting paused by ${user.email}. Reason: ${reason}`);

        await this.votingAdminService.pauseVoting(reason, user.email);

        return {
            message: 'Voting has been paused',
            reason,
            pausedBy: user.email,
            timestamp: new Date(),
        };
    }

    /**
     * Emergency: Resume voting (Super Admin only)
     */
    @Put('emergency/resume')
    @UseGuards(JwtAuthGuard, RolesGuard)
    
    @Roles(UserRole.SUPER_ADMIN)
    async resumeVoting(
        @Body() body: { reason: string },
        @CurrentUser() user: any,
    ) {
        const { reason } = body;

        if (!reason) {
            throw new BadRequestException('Reason for resuming is required');
        }

        this.logger.log(`Voting resumed by ${user.email}. Reason: ${reason}`);

        await this.votingAdminService.resumeVoting(reason, user.email);

        return {
            message: 'Voting has been resumed',
            reason,
            resumedBy: user.email,
            timestamp: new Date(),
        };
    }

    /**
     * Get active voting sessions (Admin only)
     */
    @Get('sessions/active')
    @UseGuards(JwtAuthGuard, RolesGuard)
    
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
    async getActiveSessions(@CurrentUser() user: any) {
        this.logger.debug(`Active sessions requested by: ${user.email}`);
        return this.votingAdminService.getActiveSessions();
    }

    /**
     * Export voting data (Super Admin only)
     */
    @Get('export')
    @UseGuards(JwtAuthGuard, RolesGuard)
    
    @Roles(UserRole.SUPER_ADMIN)
    async exportVotingData(
        @CurrentUser() user: any,
        @Query('format') format = 'json', // 'json', 'csv'
        @Query('includePersonalData') includePersonalData = 'false',
    ) {
        this.logger.log(`Voting data export requested by: ${user.email}, format: ${format}`);

        return this.votingAdminService.exportVotingData({
            format,
            includePersonalData: includePersonalData === 'true',
            exportedBy: user.email,
        });
    }

    /**
     * Test real-time connectivity (Admin only)
     */
    @Post('test/realtime')
    @UseGuards(JwtAuthGuard, RolesGuard)
    
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
    async testRealtimeConnection(@CurrentUser() user: any) {
        this.logger.log(`Real-time connection test by: ${user.email}`);

        // Send a test message to admins
        await this.votingService.broadcastMessage(
            `Real-time connectivity test by ${user.name} (${user.email})`,
            UserRole.SUPER_ADMIN,
            SseEventType.SYSTEM_STATUS,
        );

        return {
            message: 'Test message sent to admin channels',
            testBy: user.email,
            timestamp: new Date(),
        };
    }

    /**
     * Get voting timeline and milestones (Public)
     */
    @Get('timeline')
    async getVotingTimeline() {
        this.logger.debug('Voting timeline requested');
        return this.votingService.getVotingTimeline();
    }

    /**
     * Get public voting dashboard data (Public)
     */
    @Get('dashboard/public')
    async getPublicDashboard() {
        this.logger.debug('Public dashboard data requested');
        return this.votingService.getPublicDashboardData();
    }
}