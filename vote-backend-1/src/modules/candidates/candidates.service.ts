import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../db";
import { CacheService } from "../caches/cache.service";
import { CreateCandidateDto } from "./dto/create-candidate.dto";
import { CandidateResponseDto } from "./dto/candidate-response.dto";
import { CandidateCache } from "../caches/types/cache.types";
import { Candidate_Position } from "@prisma/client/index";
import { UpdateCandidateDto } from "./dto/update-candidate.dto";
import { BallotCandidateDto } from "./dto/ballot-candidate.dto";
import { CloudinaryService } from '../file-upload/services/cloudinary.service';

@Injectable()
export class CandidatesService {
    constructor(
        private prisma: PrismaService,
        private cacheService: CacheService,
        private cloudinaryService: CloudinaryService,
    ) {}

    //============= CRUD OPERATIONS =============

    async createCandidate(createCandidateDto: CreateCandidateDto, nominationId: string): Promise<{
        id: string;
        name: string;
        position: string;
        photoUrl: any;
        biography: any;
        candidateNumber: number;
        displayOrder: number;
        isActive: boolean;
        voteCount: number;
        createdAt: undefined;
        updatedAt: undefined;
        photoPublicId: number
    }> {
        // Check if candidate number already exists
        await this.validateCandidateNumber(createCandidateDto.candidateNumber);

        // Check if a nomination exists and is approved
        const nomination = await this.prisma.nomination.findUnique({
            where: { id: nominationId, status: 'APPROVED' }
        });

        if (!nomination) {
            throw new NotFoundException('Approved nomination not found');
        }

        // Check if a candidate already exists for this nomination
        const existingCandidate = await this.prisma.candidate.findUnique({
            where: { nominationId }
        });

        if (existingCandidate) {
            throw new ConflictException('Candidate already exists for this nomination');
        }

        const candidate = await this.prisma.candidate.create({
            //@ts-ignore
            data: {
                ...createCandidateDto,
                nominationId,
                displayOrder: createCandidateDto.displayOrder || 0,
            },
        });

        // Clear candidates cache
        await this.clearCandidatesCache();

        return this.mapToResponseDto(candidate);
    }

    async getAllCandidates(): Promise<CandidateCache[]> {
        // Try cache first
        const cached = await this.cacheService.getCandidates();
        if (cached) {
            return cached;
        }

        const candidates = await this.prisma.candidate.findMany({
            orderBy: [
                { position: 'asc' },
                { displayOrder: 'asc' },
                { candidateNumber: 'asc' }
            ],
            include: {
                nomination: {
                    select: {
                        nomineeName: true,
                        nomineeEmail: true,
                    }
                }
            }
        });

        const mappedCandidates = candidates.map(this.mapToResponseDto);

        // Cache for 1 hour
        await this.cacheService.setCandidates(mappedCandidates);

        return mappedCandidates;
    }

    async getCandidateById(id: string): Promise<{
        id: string;
        name: string;
        position: string;
        photoUrl: any;
        biography: any;
        candidateNumber: number;
        displayOrder: number;
        isActive: boolean;
        voteCount: number;
        createdAt: undefined;
        updatedAt: undefined;
        photoPublicId: number
    }> {
        const candidate = await this.prisma.candidate.findUnique({
            where: { id },
            include: {
                nomination: {
                    select: {
                        nomineeName: true,
                        nomineeEmail: true,
                    }
                }
            }
        });

        if (!candidate) {
            throw new NotFoundException('Candidate not found');
        }

        return this.mapToResponseDto(candidate);
    }

    async getCandidatesByPosition(position: Candidate_Position): Promise<{
        id: string;
        name: string;
        position: string;
        photoUrl: any;
        biography: any;
        candidateNumber: number;
        displayOrder: number;
        isActive: boolean;
        voteCount: number;
        createdAt: undefined;
        updatedAt: undefined;
        photoPublicId: number
    }[]> {
        const candidates = await this.prisma.candidate.findMany({
            where: {
                position,
                isActive: true
            },
            orderBy: [
                { displayOrder: 'asc' },
                { candidateNumber: 'asc' }
            ],
        });

        return candidates.map(this.mapToResponseDto);
    }

    async updateCandidate(id: string, updateCandidateDto: UpdateCandidateDto): Promise<{
        id: string;
        name: string;
        position: string;
        photoUrl: any;
        biography: any;
        candidateNumber: number;
        displayOrder: number;
        isActive: boolean;
        voteCount: number;
        createdAt: undefined;
        updatedAt: undefined;
        photoPublicId: number
    }> {
        // Check if a candidate exists
        await this.getCandidateById(id);

        // If updating candidate number, validate it
        if (updateCandidateDto.candidateNumber) {
            await this.validateCandidateNumber(updateCandidateDto.candidateNumber, id);
        }

        const updatedCandidate = await this.prisma.candidate.update({
            where: { id },
            data: updateCandidateDto,
        });

        // Clear cache
        await this.clearCandidatesCache();

        return this.mapToResponseDto(updatedCandidate);
    }

    async deleteCandidate(id: string): Promise<void> {
        // Check if a candidate exists
        await this.getCandidateById(id);

        // Delete photo from Supabase if exists
        const candidate = await this.prisma.candidate.findUnique({
            where: { id },
            select: { photoPublicId: true }
        });

        if (candidate?.photoPublicId) {
            await this.cloudinaryService.deleteFile(candidate.photoPublicId);
        }

        await this.prisma.candidate.delete({
            where: { id }
        });

        // Clear cache
        await this.clearCandidatesCache();
    }

    //============= BALLOT OPERATIONS =============

    async getCandidatesForBallot(): Promise<{ [position: string]: BallotCandidateDto[] }> {
        const candidates = await this.prisma.candidate.findMany({
            where: { isActive: true },
            orderBy: [
                { position: 'asc' },
                { displayOrder: 'asc' },
                { candidateNumber: 'asc' }
            ],
            select: {
                id: true,
                name: true,
                position: true,
                photoUrl: true,
                candidateNumber: true,
                displayOrder: true,
            }
        });

        // Group by position
        const ballot: { [position: string]: BallotCandidateDto[] } = {};

        candidates.forEach(candidate => {
            if (!ballot[candidate.position]) {
                ballot[candidate.position] = [];
            }
            //@ts-ignore
            ballot[candidate.position].push(candidate);
        });

        return ballot;
    }

    async getUnapposedPositions(): Promise<Candidate_Position[]> {
        const positionCounts = await this.prisma.candidate.groupBy({
            by: ['position'],
            where: { isActive: true },
            _count: { position: true }
        });

        return positionCounts
            .filter(item => item._count.position === 1)
            .map(item => item.position);
    }

    //============= PHOTO OPERATIONS =============

    async uploadCandidatePhoto(candidateId: string, file: Express.Multer.File): Promise<string> {
        // Validate file
        this.validatePhotoFile(file);

        // Get a candidate
        const candidate = await this.getCandidateById(candidateId);

        // Delete an old photo if exists
        if (candidate.photoPublicId) {
            await this.cloudinaryService.deleteFile(String(candidate.photoPublicId));
        }

        // Upload a new photo
        const result = await this.cloudinaryService.uploadCandidatePhoto(file, candidateId);

        // Update candidate record
        await this.prisma.candidate.update({
            where: { id: candidateId },
            data: {
                photoUrl: result.secure_url,
                photoPublicId: result.public_id,
            }
        });

        // Clear cache
        await this.clearCandidatesCache();

        return result.secure_url;
    }

    //============= HELPER METHODS =============

    private async validateCandidateNumber(candidateNumber: number | undefined, excludeId?: string): Promise<void> {
        const existing = await this.prisma.candidate.findFirst({
            where: {
                candidateNumber,
                ...(excludeId && { NOT: { id: excludeId } })
            }
        });

        if (existing) {
            throw new ConflictException(`Candidate number ${candidateNumber} already exists`);
        }
    }

    private validatePhotoFile(file: Express.Multer.File): void {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        const maxSize = 2 * 1024 * 1024; // 2MB

        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new BadRequestException('Only JPEG and PNG files are allowed');
        }

        if (file.size > maxSize) {
            throw new BadRequestException('File size must be less than 2MB');
        }
    }

    private mapToResponseDto(candidate: any): {
        id: string;
        name: string;
        position: string;
        photoUrl: any;
        biography: any;
        candidateNumber: number;
        displayOrder: number;
        isActive: boolean;
        voteCount: number;
        createdAt: undefined;
        updatedAt: undefined;
        photoPublicId: number
    } {
        return {
            id: candidate.id,
            name: candidate.name,
            position: candidate.position,
            photoUrl: candidate.photoUrl,
            biography: candidate.biography,
            candidateNumber: candidate.candidateNumber,
            displayOrder: candidate.displayOrder,
            isActive: candidate.isActive,
            voteCount: candidate.voteCount,
            createdAt: candidate.createdAt,
            updatedAt: candidate.updatedAt,
            photoPublicId: 0
        };
    }

    private async clearCandidatesCache(): Promise<void> {
        await this.cacheService.clearCandidatesCache();
    }
}