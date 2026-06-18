import { NominationService } from "../services/nomination.service";
import { CreateNominationDto } from "../dto/create-nomination.dto";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import {
    BadRequestException,
    Body,
    Controller,
    Get, InternalServerErrorException,
    Logger,
    Param,
    Post,
    Query, UploadedFile,
    UseGuards,
    UseInterceptors
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { NominationStatus } from "@prisma/client/index";
import {FileInterceptor} from "@nestjs/platform-express";

@Controller('nominations')
@UseGuards(JwtAuthGuard)
export class NominationsController {
    private readonly logger = new Logger(NominationsController.name);

    constructor(private nominationService: NominationService) {}

    @Post()
    @UseInterceptors(FileInterceptor('photo'))
    async create(
        @Body() createNominationDto: CreateNominationDto,
        @UploadedFile() file: Express.Multer.File,
    ) {
        try {
            const nomination = await this.nominationService.createNomination(createNominationDto, file);
            return {
                success: true,
                data: nomination,
                message: 'Nomination created successfully',
            };
        } catch (error) {
            this.logger.error(`Failed to create nomination: ${error.message}`, error.stack);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Internal server error');
        }
    }

    @Get('my-nominations')
    async getMyNominations(@CurrentUser() user: any) {
        return this.nominationService.findAll({
            aspirantId: user.id,
        });
    }

    @Get('statistics')
    async getStatistics() {
        return this.nominationService.getStatistics();
    }

    @Get('by-position/:position')
    async getNominationsByPosition(@Param('position') position: string) {
        return this.nominationService.getNominationsByPosition(position);
    }

    @Get(':id')
    async getNomination(@Param('id') id: string) {
        return this.nominationService.findOne(id);
    }

    @Get()
    async getAllNominations(
        @Query('status') status?: NominationStatus,
        @Query('position') position?: string,
    ) {
        return this.nominationService.findAll({
            status,
            position,
        });
    }
}