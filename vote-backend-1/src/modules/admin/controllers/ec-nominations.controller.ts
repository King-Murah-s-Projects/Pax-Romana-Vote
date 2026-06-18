import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { UserRoles } from "../../users/enums/user-roles.enum";
import { NominationReviewService } from "../services/nomination-review.service";
import { EcConsensusService } from '../../common/utils/ec-consensus.service';
import { BulkNominationReviewDto, NominationReviewDto } from "../dto/nomination-review.dto";


@Controller('admin/ec/nominations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoles.EC_MEMBER, UserRoles.SUPER_ADMIN)
export class EcNominationsController {
    constructor(
        private nominationReviewService: NominationReviewService,
        private ecConsensusService: EcConsensusService,
    ) {}

    @Get()
    async getNominationsForReview(@Req() req) {
        return this.nominationReviewService.getNominationsForReview();
    }

    @Post('review')
    async reviewNomination(@Body() reviewDto: NominationReviewDto, @Req() req) {
        return this.nominationReviewService.reviewNomination(reviewDto, req.user.id);
    }

    @Post('bulk-review')
    async bulkReviewNominations(@Body() bulkReviewDto: BulkNominationReviewDto, @Req() req) {
        return this.nominationReviewService.bulkReviewNominations(bulkReviewDto, req.user.id);
    }

    @Get('consensus/:nominationId')
    async getConsensusStatus(@Param('nominationId') nominationId: string) {
        return this.ecConsensusService.checkConsensus(nominationId);
    }

    @Get('consensus')
    async getAllConsensusStatuses() {
        return this.ecConsensusService.getAllConsensusStatuses();
    }
}