import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../db';
import { NominationWorkflowService } from './nomination-workflow.service';
import { VerificationResponseDto } from '../dto/verification-response.dto';
import { VerificationStatus, VerificationTargetType } from '@prisma/client/index';

@Injectable()
export class NominatorVerificationService {
    constructor(
        private prisma: PrismaService,
        private workflowService: NominationWorkflowService,
    ) {}

    async verifyNominator(verificationDto: VerificationResponseDto) {
        const { verificationToken, action, reason } = verificationDto;

        // Find the verification token
        const tokenRecord = await this.prisma.verificationToken.findUnique({
            where: { token: verificationToken },
        });

        if (!tokenRecord || tokenRecord.verificationType !== 'NOMINATOR') {
            throw new BadRequestException('Invalid verification token');
        }

        if (tokenRecord.expiresAt < new Date()) {
            throw new BadRequestException('Verification token has expired');
        }

        const nominatorVerification = await this.prisma.nominatorVerification.findUnique({
            where: { id: tokenRecord.verificationId },
            include: {
                nomination: {
                    include: {
                        aspirant: true,
                        nominatorVerification: true,
                        guarantorVerifications: true,
                    },
                },
            },
        });

        if (!nominatorVerification) {
            throw new BadRequestException('Invalid verification token');
        }

        if (nominatorVerification.status !== VerificationStatus.PENDING) {
            throw new BadRequestException('This verification has already been processed');
        }

        // Update nominator verification status
        const updateData = {
            //@ts-ignore
            status: action === 'approve' ? VerificationStatus.VERIFIED : VerificationStatus.DECLINED,
            //@ts-ignore
            verifiedAt: action === 'approve' ? new Date() : null,
            //@ts-ignore
            declinedAt: action === 'decline' ? new Date() : null,
        };

        await this.prisma.nominatorVerification.update({
            where: { id: nominatorVerification.id },
            data: updateData,
        });

        // Process through workflow
        await this.workflowService.processVerification(
            verificationToken,
            //@ts-ignore
            action === 'approve' ? 'CONFIRM' : 'DECLINE',
            reason
        );

        return {
            message: `Verification ${action.toLowerCase()}ed successfully`,
            nominationId: nominatorVerification.nominationId,
        };
    }

    async getVerificationDetails(token: string) {
        const tokenRecord = await this.prisma.verificationToken.findUnique({
            where: { token },
        });

        if (!tokenRecord || tokenRecord.verificationType !== 'NOMINATOR') {
            throw new BadRequestException('Invalid verification token');
        }

        const nominatorVerification = await this.prisma.nominatorVerification.findUnique({
            where: { id: tokenRecord.verificationId },
            include: {
                nomination: {
                    include: {
                        aspirant: {
                            select: {
                                id: true,
                                name: true,
                                phone: true,
                                email: true,
                            },
                        },
                        nominatorVerification: {
                            select: {
                                name: true,
                                status: true,
                                verifiedAt: true,
                            },
                        },
                        guarantorVerifications: {
                            select: {
                                name: true,
                                status: true,
                                verifiedAt: true,
                            },
                        },
                    },
                },
            },
        });

        if (!nominatorVerification) {
            throw new BadRequestException('Invalid verification token');
        }

        const isExpired = tokenRecord.expiresAt < new Date();

        if (isExpired) {
            throw new BadRequestException('Verification token has expired');
        }

        return {
            nomination: nominatorVerification.nomination,
            nominatorName: nominatorVerification.name,
            nominatorEmail: nominatorVerification.email,
            tokenType: VerificationTargetType.NOMINATOR,
            isExpired,
            isAlreadyVerified: nominatorVerification.status !== VerificationStatus.PENDING,
            verificationStatus: nominatorVerification.status,
        };
    }
}