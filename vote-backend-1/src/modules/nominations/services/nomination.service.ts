import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../db';
import { DeadlineService } from '../../common/utils/deadline.service';
import { CreateNominationDto } from '../dto/create-nomination.dto';
import { NominationStatus, Candidate_Position, UserRole } from '@prisma/client/index';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from "../../users/users.service";
import { CloudinaryService } from '../../file-upload/services/cloudinary.service';
import {IUser} from "../../users/interfaces/user.interface";

function mapPositionToEnum(position: string): Candidate_Position {
    const positionMap: { [key: string]: Candidate_Position } = {
        'President': Candidate_Position.PRESIDENT,
        'Vice President': Candidate_Position.VICE_PRESIDENT,
        'General Secretary': Candidate_Position.GEN_SECRETARY,
        'Financial Secretary': Candidate_Position.FINANCIAL_SECRETARY,
        'Organizing Secretary Main': Candidate_Position.ORGANIZING_SECRETARY_MAIN,
        'PRO Main': Candidate_Position.PRO_MAIN,
        'Women Commissioner': Candidate_Position.WOMEN_COMMISSIONER,
    };
    return positionMap[position] || Candidate_Position.PRESIDENT;
}

@Injectable()
export class NominationService {
    private readonly logger = new Logger(NominationService.name);

    constructor(
        public prisma: PrismaService,
        private deadlineService: DeadlineService,
        public usersService: UsersService,
        private cloudinaryService: CloudinaryService,
    ) {}

    async createNomination(createNominationDto: CreateNominationDto, file?: Express.Multer.File, userId?: string) {
        if (!this.deadlineService.isNominationOpen()) {
            throw new BadRequestException('Nomination period has ended');
        }

        //@ts-ignore
        let user: IUser | null = await this.usersService.findByEmail(createNominationDto.aspirantEmail);
        if (!user) {
            //@ts-ignore
            user = await this.usersService.create({
                name: createNominationDto.aspirantName,
                email: createNominationDto.aspirantEmail,
                phone: createNominationDto.aspirantPhoneNumber,
                //@ts-ignore
                role: UserRole.ASPIRANT,
                programme: createNominationDto.nomineeProgramme,
                level: createNominationDto.nomineeLevel,
                subgroup: createNominationDto.nomineeSubgroups[0] || 'Unknown',
                college: createNominationDto.nomineeCollege,
            });
        }

        // @ts-ignore
        if (userId && user.id !== userId) {
            throw new BadRequestException('Authenticated user does not match aspirant');
        }

        const nomineePosition = mapPositionToEnum(createNominationDto.position);

        const existingNomination = await this.prisma.nomination.findFirst({
            where: {
                //@ts-ignore
                aspirantId: user.id,
                nomineePosition: nomineePosition,
                status: {
                    notIn: [NominationStatus.REJECTED],
                },
            },
        });

        if (existingNomination) {
            throw new BadRequestException('You already have a nomination for this position');
        }

        let photoUrl: string | undefined;
        if (file) {
            try {
                //@ts-ignore
                const uploadResult = await this.cloudinaryService.uploadCandidatePhoto(file, user.id);
                photoUrl = uploadResult.secure_url;
            } catch (error) {
                throw new BadRequestException('Failed to upload candidate photo');
            }
        } else if (!createNominationDto.photoUrl) {
            throw new BadRequestException('Candidate photo is required');
        } else {
            photoUrl = createNominationDto.photoUrl;
        }

        const nomination = await this.prisma.nomination.create({
            data: {
                //@ts-ignore
                aspirantId: user.id,
                nomineeName: createNominationDto.aspirantName,
                nomineeEmail: createNominationDto.aspirantEmail,
                nomineeContact: createNominationDto.aspirantPhoneNumber,
                nomineePosition: nomineePosition,
                photoUrl,
                status: NominationStatus.PENDING,
                nomineeCollege: createNominationDto.nomineeCollege,
                nomineeDepartment: createNominationDto.nomineeDepartment,
                nomineeDateOfBirth: new Date(createNominationDto.nomineeDateOfBirth),
                nomineeHostel: createNominationDto.nomineeHostel,
                nomineeRoom: createNominationDto.nomineeRoom,
                nomineeSex: createNominationDto.nomineeSex,
                nomineeCwa: createNominationDto.nomineeCwa,
                nomineeProgramme: createNominationDto.nomineeProgramme,
                nomineeLevel: createNominationDto.nomineeLevel,
                nomineeParish: createNominationDto.nomineeParish,
                nomineeNationality: createNominationDto.nomineeNationality,
                nomineeRegion: createNominationDto.nomineeRegion,
                nomineeSubgroups: createNominationDto.nomineeSubgroups,
                nomineeEducation: createNominationDto.nomineeEducation,
                hasLeadershipPosition: createNominationDto.hasLeadershipPosition,
                leadershipPositions: createNominationDto.leadershipPositions,
                hasServedCommittee: createNominationDto.hasServedCommittee,
                committees: createNominationDto.committees,
                skills: createNominationDto.skills,
                visionForOffice: createNominationDto.visionForOffice,
                knowledgeAboutOffice: createNominationDto.knowledgeAboutOffice,
                nominatorVerification: {
                    create: {
                        name: createNominationDto.nominatorVerification.name,
                        email: createNominationDto.nominatorVerification.email,
                        contact: createNominationDto.nominatorVerification.contact,
                        programme: createNominationDto.nominatorVerification.programme,
                        level: createNominationDto.nominatorVerification.level,
                        subgroup: createNominationDto.nominatorVerification.subgroup,
                        status: 'PENDING',
                    },
                },
                guarantorVerifications: {
                    createMany: {
                        data: createNominationDto.guarantorVerifications.map((guarantor) => ({
                            name: guarantor.name,
                            email: guarantor.email,
                            contact: guarantor.contact,
                            programme: guarantor.programme,
                            subgroup: guarantor.subgroup,
                            status: 'PENDING',
                        })),
                    },
                },
            },
            include: {
                nominatorVerification: true,
                guarantorVerifications: true,
            },
        });

        // Generate tokens for verification (you'll need these for manual verification)
        const nominatorToken = uuidv4();
        const guarantorTokens = createNominationDto.guarantorVerifications.map(() => uuidv4());

        // Store tokens in database for later use
        await this.prisma.verificationToken.create({
            data: {
                token: nominatorToken,
                email: nomination.nominatorVerification!.email,
                expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
                verificationId: nomination.nominatorVerification!.id,
                verificationType: 'NOMINATOR' as const,
            },
        });

        await this.prisma.verificationToken.createMany({
            data: guarantorTokens.map((token, index) => ({
                token,
                email: nomination.guarantorVerifications[index].email,
                expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
                verificationId: nomination.guarantorVerifications[index].id,
                verificationType: 'GUARANTOR' as const,
            })),
        });

        // ALL EMAIL SENDING REMOVED - You can manually send emails using the data from database
        // The verification tokens and emails are stored in the database for your manual use

        // Log the verification details for manual processing
        this.logger.warn('Nomination created — manual verification emails required. Check DB for tokens.', {
            nominationId: nomination.id,
            nominatorEmail: nomination.nominatorVerification!.email,
            guarantorEmails: nomination.guarantorVerifications.map((g) => g.email),
        });

        return nomination;
    }

    // Helper method to get pending verifications for manual email sending
    async getPendingVerifications() {
        const pendingTokens = await this.prisma.verificationToken.findMany({
            where: { expiresAt: { gt: new Date() }, used: false },
        });

        return Promise.all(
            pendingTokens.map(async (token) => {
                if (token.verificationType === 'NOMINATOR') {
                    const verification = await this.prisma.nominatorVerification.findUnique({
                        where: { id: token.verificationId },
                        include: {
                            nomination: { select: { nomineeName: true, nomineePosition: true } },
                        },
                    });
                    return { ...token, nominatorVerification: verification, guarantorVerification: null };
                } else {
                    const verification = await this.prisma.guarantorVerification.findUnique({
                        where: { id: token.verificationId },
                        include: {
                            nomination: { select: { nomineeName: true, nomineePosition: true } },
                        },
                    });
                    return { ...token, nominatorVerification: null, guarantorVerification: verification };
                }
            }),
        );
    }

    async findAll(filters?: {
        status?: NominationStatus;
        position?: string;
        aspirantId?: string;
    }) {
        return this.prisma.nomination.findMany({
            where: {
                ...(filters?.status && { status: filters.status }),
                ...(filters?.position && { position: filters.position }),
                ...(filters?.aspirantId && { aspirantId: filters.aspirantId }),
            },
            include: {
                //@ts-ignore
                nominator: true,
                guarantors: true,
                ecVotes: {
                    include: {
                        ecMember: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async findOne(id: string) {
        const nomination = await this.prisma.nomination.findUnique({
            where: { id },
            include: {
                //@ts-ignore
                nominator: true,
                guarantors: true,
                ecVotes: {
                    include: {
                        ecMember: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        if (!nomination) {
            throw new NotFoundException('Nomination not found');
        }

        return nomination;
    }

    async updateStatus(id: string, status: NominationStatus, reason?: string) {
        return this.prisma.nomination.update({
            where: { id },
            data: {
                status,
                ...(reason && { rejectionReason: reason }),
                ...(status === NominationStatus.APPROVED && { approvedAt: new Date() }),
                ...(status === NominationStatus.REJECTED && { rejectedAt: new Date() }),
            },
        });
    }

    async getNominationsByPosition(position: string) {
        return this.prisma.nomination.findMany({
            where: {
                //@ts-ignore
                position,
                status: {
                    in: [NominationStatus.APPROVED, NominationStatus.UNDER_REVIEW],
                },
            },
            include: {
                //@ts-ignore
                nominator: true,
                guarantors: true,
            },
        });
    }

    async getStatistics() {
        const total = await this.prisma.nomination.count();
        const approved = await this.prisma.nomination.count({
            where: { status: NominationStatus.APPROVED },
        });
        const pending = await this.prisma.nomination.count({
            where: { status: NominationStatus.UNDER_REVIEW },
        });
        const rejected = await this.prisma.nomination.count({
            where: { status: NominationStatus.REJECTED },
        });

        return {
            total,
            approved,
            pending,
            rejected,
            timeRemaining: this.deadlineService.getTimeRemaining(),
        };
    }
}