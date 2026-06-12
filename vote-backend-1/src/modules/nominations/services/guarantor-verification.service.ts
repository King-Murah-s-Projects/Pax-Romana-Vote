import { PrismaService } from "../../../../db";
import { NominationWorkflowService } from "./nomination-workflow.service";
import { VerificationResponseDto } from "../../auth/dto/auth-response.dto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { VerificationStatus, VerificationTargetType, GuarantorVerification, NominatorVerification } from "@prisma/client/index";

@Injectable()
export class GuarantorVerificationService {
    private notificationService: any;
    constructor(
        private prisma: PrismaService,
        private workflowService: NominationWorkflowService,
    ) {}

    async verifyGuarantor(verificationDto: VerificationResponseDto) {
        const { verificationToken, action, reason } = verificationDto;

        // Find the guarantor verification record using the token
        const guarantorVerification = await this.prisma.guarantorVerification.findUnique({
            //@ts-ignore
            where: { verificationToken },
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

        if (!guarantorVerification) {
            throw new BadRequestException('Invalid verification token');
        }

        //@ts-ignore
        if (guarantorVerification.tokenExpiresAt && guarantorVerification.tokenExpiresAt < new Date()) {
            throw new BadRequestException('Verification token has expired');
        }

        if (guarantorVerification.status !== VerificationStatus.PENDING) {
            throw new BadRequestException('This verification has already been processed');
        }

        // Update guarantor verification status
        const updateData = {
            status: action === 'approve' ? VerificationStatus.VERIFIED : VerificationStatus.DECLINED,
            verifiedAt: action === 'approve' ? new Date() : null,
            declinedAt: action === 'decline' ? new Date() : null,
        };

        await this.prisma.guarantorVerification.update({
            where: { id: guarantorVerification.id },
            data: updateData,
        });

        // Fix: Use the existing processVerification method with correct parameters
        await this.workflowService.processVerification(
            //@ts-ignore
            guarantorVerification.verificationToken,
            action === 'approve' ? 'CONFIRM' : 'DECLINE',
            reason
        );

        return {
            message: `Verification ${action.toLowerCase()}ed successfully`,
            nominationId: guarantorVerification.nominationId,
        };
    }

    async getVerificationDetails(token: string) {
        const guarantorVerification = await this.prisma.guarantorVerification.findUnique({
            //@ts-ignore
            where: { verificationToken: token },
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

        if (!guarantorVerification) {
            throw new BadRequestException('Invalid verification token');
        }

        //@ts-ignore
        const isExpired = guarantorVerification.tokenExpiresAt
            //@ts-ignore
            ? guarantorVerification.tokenExpiresAt < new Date()
            : false;

        if (isExpired) {
            throw new BadRequestException('Verification token has expired');
        }

        return {
            //@ts-ignore
            nomination: guarantorVerification.nomination,
            guarantorName: guarantorVerification.name,
            guarantorEmail: guarantorVerification.email,
            tokenType: VerificationTargetType.GUARANTOR,
            isExpired,
            isAlreadyVerified: guarantorVerification.status !== VerificationStatus.PENDING,
            verificationStatus: guarantorVerification.status,
        };
    }

    async resendVerificationEmail(nominationId: string, guarantorEmail: string) {
        const guarantorVerification = await this.prisma.guarantorVerification.findFirst({
            where: {
                nominationId,
                email: guarantorEmail,
                status: VerificationStatus.PENDING,
            },
            include: {
                nomination: {
                    include: {
                        aspirant: true,
                    },
                },
            },
        });

        if (!guarantorVerification) {
            throw new BadRequestException('No pending verification found for this guarantor');
        }

        // Generate new token and expiration
        const newToken = this.generateVerificationToken();
        const newExpiration = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

        await this.prisma.guarantorVerification.update({
            where: { id: guarantorVerification.id },
            data: {
                //@ts-ignore
                verificationToken: newToken,
                tokenExpiresAt: newExpiration,
            },
        });

        // Send email through notification service
        await this.notificationService.sendGuarantorVerificationEmail(guarantorVerification);

        return {
            message: 'Verification email resent successfully',
            expiresAt: newExpiration,
        };
    }

    private generateVerificationToken(): string {
        return require('crypto').randomBytes(32).toString('hex');
    }
}