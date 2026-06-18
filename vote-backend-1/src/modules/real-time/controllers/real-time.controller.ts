import {Controller, Get, Logger, Query, Req, Res, UseGuards} from "@nestjs/common";
import { SseConnectionInfo } from "../interfaces/sse-client.interface";
import { UserRole } from "@prisma/client/index";
import { Request, Response } from 'express';
import {RealTimeService} from "../services/real-time.service";
import { v4 as uuidv4 } from 'uuid';
import {JwtAuthGuard} from "../../auth/guards/jwt-auth.guard";
import {RolesGuard} from "../../auth/guards/roles.guard";
import {Roles} from "../../auth/decorators/roles.decorator";
import {CurrentUser} from "../../auth/decorators/current-user.decorator";

@Controller('real-time')
export class RealTimeController {
    private readonly logger = new Logger(RealTimeController.name);

    constructor(private realtimeService: RealTimeService) {}

    /**
     * Public voting progress stream (limited data)
     */
    @Get('voting-progress')
    votingProgressStream(@Req() req: Request, @Res() res: Response) {
        const clientId = uuidv4();
        const connectionInfo: SseConnectionInfo = {
            clientId,
            role: UserRole.VOTER, // Default to voter for public stream
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip,
        };

        this.realtimeService.addClient(connectionInfo, res);
        this.logger.log(`Public voting progress stream connected: ${clientId}`);
    }

    /**
     * Admin dashboard stream (full data, admin only)
     */
    @Get('admin-dashboard')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
    adminDashboardStream(
        @Req() req: Request,
        @Res() res: Response,
        @CurrentUser() user: any,
    ) {
        const clientId = uuidv4();
        const connectionInfo: SseConnectionInfo = {
            clientId,
            userId: user.id,
            role: user.role,
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip,
        };

        this.realtimeService.addClient(connectionInfo, res);
        this.logger.log(`Admin dashboard stream connected: ${clientId} (User: ${user.id})`);
    }

    /**
     * Results stream (live results during counting)
     */
    @Get('results')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EC_MEMBER)
    resultsStream(
        @Req() req: Request,
        @Res() res: Response,
        @CurrentUser() user: any,
        @Query('position') position?: string,
    ) {
        const clientId = uuidv4();
        const connectionInfo: SseConnectionInfo = {
            clientId,
            userId: user.id,
            role: user.role,
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip,
        };

        this.realtimeService.addClient(connectionInfo, res);
        this.logger.log(`Results stream connected: ${clientId} (Position: ${position || 'all'})`);
    }

    /**
     * System monitoring stream (super admin only)
     */
    @Get('system-monitor')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    systemMonitorStream(
        @Req() req: Request,
        @Res() res: Response,
        @CurrentUser() user: any,
    ) {
        const clientId = uuidv4();
        const connectionInfo: SseConnectionInfo = {
            clientId,
            userId: user.id,
            role: user.role,
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip,
        };

        this.realtimeService.addClient(connectionInfo, res);
        this.logger.log(`System monitor stream connected: ${clientId}`);
    }
}