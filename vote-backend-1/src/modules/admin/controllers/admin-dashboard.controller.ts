import {Controller, Get, Query, UseGuards} from "@nestjs/common";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { UserRoles } from "../../users/enums/user-roles.enum";
import { AdminDashboardService } from "../services/admin-dashboard.service";
import { NominationStatsFilterDto } from "../dto/admin-dashboard.dto";
import { NominationStatisticsService } from "../services/nomination-statistics.service";


@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoles.EC_MEMBER, UserRoles.SUPER_ADMIN)
export class AdminDashboardController {
    constructor(
        private adminDashboardService: AdminDashboardService,
        private nominationStatisticsService: NominationStatisticsService,
    ) {}

    @Get()
    async getDashboardData() {
        return this.adminDashboardService.getDashboardData();
    }

    @Get('statistics')
    async getStatistics(@Query() filterDto: NominationStatsFilterDto) {
        return this.nominationStatisticsService.getStatistics(filterDto);
    }

    @Get('health')
    async getSystemHealth() {
        return this.adminDashboardService.getSystemHealth();
    }
}