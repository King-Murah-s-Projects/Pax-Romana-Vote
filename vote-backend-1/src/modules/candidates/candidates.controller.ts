import {
    Body,
    Controller,
    Delete,
    Get,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query, UploadedFile,
    UseGuards,
    UseInterceptors
} from "@nestjs/common";
import { CandidatesService } from "./candidates.service";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { CreateCandidateDto } from "./dto/create-candidate.dto";
import { UpdateCandidateDto } from "./dto/update-candidate.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import {Candidate_Position, UserRole} from "@prisma/client/index";
import {Roles} from "../auth/decorators/roles.decorator";

@Controller('candidates')
export class CandidatesController {
    constructor(private readonly candidatesService: CandidatesService) {}

    //============= SUPER ADMIN ONLY ENDPOINTS =============

    @Post()
    @UseGuards(SuperAdminGuard)
    @Roles(UserRole.SUPER_ADMIN)
    async create(
        @Body() createCandidateDto: CreateCandidateDto,
        @Query('nominationId') nominationId: string
    ) {
        return {
            statusCode: HttpStatus.CREATED,
            message: 'Candidate created successfully',
            data: await this.candidatesService.createCandidate(createCandidateDto, nominationId),
        };
    }

    @Get('admin/all')
    @UseGuards(SuperAdminGuard)
    @Roles(UserRole.SUPER_ADMIN)
    async findAllForAdmin() {
        return {
            statusCode: HttpStatus.OK,
            message: 'Candidates retrieved successfully',
            data: await this.candidatesService.getAllCandidates(),
        };
    }

    @Get('admin/:id')
    @UseGuards(SuperAdminGuard)
    @Roles(UserRole.SUPER_ADMIN)
    async findOneForAdmin(@Param('id') id: string) {
        return {
            statusCode: HttpStatus.OK,
            message: 'Candidate retrieved successfully',
            data: await this.candidatesService.getCandidateById(id),
        };
    }

    @Patch(':id')
    @UseGuards(SuperAdminGuard)
    @Roles(UserRole.SUPER_ADMIN)
    async update(@Param('id') id: string, @Body() updateCandidateDto: UpdateCandidateDto) {
        return {
            statusCode: HttpStatus.OK,
            message: 'Candidate updated successfully',
            data: await this.candidatesService.updateCandidate(id, updateCandidateDto),
        };
    }

    @Delete(':id')
    @UseGuards(SuperAdminGuard)
    @Roles(UserRole.SUPER_ADMIN)
    async remove(@Param('id') id: string) {
        await this.candidatesService.deleteCandidate(id);
        return {
            statusCode: HttpStatus.OK,
            message: 'Candidate deleted successfully',
        };
    }

    @Post(':id/photo')
    @UseGuards(SuperAdminGuard)
    @Roles(UserRole.SUPER_ADMIN)
    @UseInterceptors(FileInterceptor('photo'))
    async uploadPhoto(
        @Param('id') id: string,
        @UploadedFile() file: Express.Multer.File
    ) {
        return {
            statusCode: HttpStatus.OK,
            message: 'Photo uploaded successfully',
            data: {
                photoUrl: await this.candidatesService.uploadCandidatePhoto(id, file)
            },
        };
    }

    //============= PUBLIC ENDPOINTS (FOR VOTERS) =============

    @Get('ballot')
    async getBallot() {
        return {
            statusCode: HttpStatus.OK,
            message: 'Ballot retrieved successfully',
            data: await this.candidatesService.getCandidatesForBallot(),
        };
    }

    @Get('position/:position')
    async getCandidatesByPosition(@Param('position') position: Candidate_Position) {
        return {
            statusCode: HttpStatus.OK,
            message: 'Candidates retrieved successfully',
            data: await this.candidatesService.getCandidatesByPosition(position),
        };
    }

    @Get('unopposed')
    async getUnapposedPositions() {
        return {
            statusCode: HttpStatus.OK,
            message: 'Unopposed positions retrieved successfully',
            data: await this.candidatesService.getUnapposedPositions(),
        };
    }
}