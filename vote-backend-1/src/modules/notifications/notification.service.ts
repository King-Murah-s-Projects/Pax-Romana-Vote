import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MnotifySmsService } from './service/mnotify-sms.service';
import { EmailService } from './service/email.service';
import { AdminNotificationsService } from './service/admin-notifications.service';
import { PrismaService } from '../../../db';
import { AdminActions } from '../common/enums/nomination-status.enum';
import { UserRole, Candidate_Position } from '@prisma/client/index';

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.EC_MEMBER, UserRole.SUPER_ADMIN] as const;

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private notifySmsService: MnotifySmsService,
        private emailService: EmailService,
        private prisma: PrismaService,
        private adminNotificationsService: AdminNotificationsService,
    ) {}

    // ── Recipient resolution ─────────────────────────────────────────────────
    // Single seam for all prisma.user queries in this module.

    async recipientsFor(
        roles: UserRole | UserRole[],
    ): Promise<{ email: string; phone: string | null }[]> {
        const roleArray = Array.isArray(roles) ? roles : [roles];
        return this.prisma.user.findMany({
            where: { role: { in: roleArray }, isActive: true },
            select: { email: true, phone: true },
        });
    }

    // ── Domain event handlers ────────────────────────────────────────────────

    @OnEvent('ballot.cast')
    async onBallotCast(payload: { positionIds: string[] }): Promise<void> {
        try {
            const recipients = await this.recipientsFor([...ADMIN_ROLES]);
            for (const r of recipients) {
                if (r.email) {
                    await this.emailService.sendEmail({
                        to: r.email,
                        subject: 'Ballot cast — turnout update',
                        html: `<p>A ballot was cast. Position IDs: ${payload.positionIds.join(', ')}.</p>`,
                    });
                }
            }
        } catch (error) {
            this.logger.error('Failed to handle ballot.cast event', error);
        }
    }

    // TODO: wire when nomination events land
    // @OnEvent('nomination.status_changed')
    // async onNominationStatusChanged(payload: { nominationId: string; status: string }): Promise<void> {}

    // ── Nomination notifications ─────────────────────────────────────────────

    async notifyNominationStatusChange(
        nominationData: any,
        status: string,
        reason?: string,
    ): Promise<void> {
        try {
            await this.emailService.sendNominationStatusEmail(
                nominationData.nominee.email,
                nominationData.nominee.name,
                status,
                reason,
            );
            await this.notifySmsService.sendNominationStatusUpdate(
                nominationData.nominee.phoneNumber,
                nominationData.nominee.name,
                status,
                // @ts-ignore
                reason,
            );
        } catch (error) {
            this.logger.error('Failed to send nomination status change notification:', error);
            throw error;
        }
    }

    async notifyAdminsOfNewNomination(data: {
        nominationId: string;
        nomineeName: string;
        position: string;
        createdAt: Date;
    }): Promise<void> {
        const admins = await this.recipientsFor([...ADMIN_ROLES]);
        const adminEmails = admins.map((a) => a.email).filter(Boolean) as string[];
        try {
            const success = await this.emailService.sendAdminNotificationEmail(
                adminEmails,
                `New Nomination: ${data.nomineeName}`,
                {
                    nomineeName: data.nomineeName,
                    position: data.position,
                    submissionDate: data.createdAt.toISOString(),
                    reviewUrl: `${process.env.FRONTEND_URL}/admin/nominations/${data.nominationId}/review`,
                },
            );
            if (!success) {
                throw new Error(`Failed to send admin notification to ${adminEmails.join(', ')}`);
            }
            this.logger.log(`Admin notification sent to ${adminEmails.join(', ')}`);
        } catch (error) {
            this.logger.error('Failed to send admin notification', error);
            throw error;
        }
    }

    async notifyAdminsOfReadyNomination(nominationData: any): Promise<void> {
        try {
            await this.adminNotificationsService.notifyNominationReady(nominationData);
        } catch (error) {
            this.logger.error('Failed to notify admins of ready nomination:', error);
            throw error;
        }
    }

    async sendNominatorVerificationEmail(data: {
        nomination: { nomineeName: string; nomineePosition: Candidate_Position };
        nominatorEmail: string;
        nominatorName: string;
        token: string;
    }): Promise<void> {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-nomination/${data.token}`;
        try {
            const result = await this.emailService.sendEmail({
                to: data.nominatorEmail,
                subject: `Nominator Verification for ${data.nomination.nomineeName}'s Nomination`,
                template: 'nominator-verification',
                templateData: {
                    nominatorName: data.nominatorName,
                    nomineeName: data.nomination.nomineeName,
                    position: data.nomination.nomineePosition,
                    verificationUrl,
                    expirationHours: 48,
                    submissionDate: new Date().toLocaleDateString(),
                },
            });
            if (!result.success) {
                throw new Error(`Failed to send nominator verification email to ${data.nominatorEmail}`);
            }
            this.logger.log(`Nominator verification email sent to ${data.nominatorEmail}`);
        } catch (error) {
            this.logger.error(`Failed to send nominator verification email to ${data.nominatorEmail}`, error);
            throw error;
        }
    }

    async sendGuarantorVerificationEmail(data: {
        nomination: { nomineeName: string; nomineePosition: string };
        guarantorName: string;
        guarantorEmail: string;
        token: string;
    }): Promise<void> {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-nomination/${data.token}`;
        try {
            const result = await this.emailService.sendEmail({
                to: data.guarantorEmail,
                subject: `Guarantor Verification for ${data.nomination.nomineeName}'s Nomination`,
                template: 'guarantor-verification',
                templateData: {
                    guarantorName: data.guarantorName,
                    nomineeName: data.nomination.nomineeName,
                    position: data.nomination.nomineePosition,
                    verificationUrl,
                    expirationHours: 48,
                    submissionDate: new Date().toLocaleDateString(),
                },
            });
            if (!result.success) {
                throw new Error(`Failed to send guarantor verification email to ${data.guarantorEmail}`);
            }
            this.logger.log(`Guarantor verification email sent to ${data.guarantorEmail}`);
        } catch (error) {
            this.logger.error(`Failed to send guarantor verification email to ${data.guarantorEmail}`, error);
            throw error;
        }
    }

    async notifyNominationVerificationComplete(data: {
        nominee: { name: string; email: string; phoneNumber: string };
        position: string;
        createdAt: Date;
    }): Promise<void> {
        try {
            const success = await this.emailService.sendVerificationCompleteEmail(data.nominee.email, {
                nomineeName: data.nominee.name,
                position: data.position,
                completionDate: data.createdAt.toISOString(),
            });
            if (!success) {
                throw new Error(`Failed to send verification complete email to ${data.nominee.email}`);
            }
            this.logger.log(`Verification complete email sent to ${data.nominee.email}`);
        } catch (error) {
            this.logger.error(`Failed to send verification complete email to ${data.nominee.email}`, error);
            throw error;
        }
    }

    async notifyEcMembersOfDecision(
        nominationId: string,
        reviewerId: string,
        action: AdminActions,
    ): Promise<void> {
        try {
            const nomination = await this.prisma.nomination.findUnique({
                where: { id: nominationId },
                include: { aspirant: true },
            });
            if (!nomination) throw new Error('Nomination not found');

            // recipientsFor for EC members, excluding the reviewer
            const allAdmins = await this.recipientsFor([...ADMIN_ROLES]);
            const reviewer = await this.prisma.user.findUnique({
                where: { id: reviewerId },
                select: { name: true, email: true },
            });
            const ecMemberEmails = allAdmins
                .filter((r) => r.email !== reviewer?.email)
                .map((r) => r.email)
                .filter(Boolean) as string[];

            await this.adminNotificationsService.notifyEcMemberOfDecision({
                ecMemberEmails,
                reviewerName: reviewer?.name || 'Unknown',
                aspirantName: nomination.nomineeName,
                position: nomination.nomineePosition,
                action,
                nominationId,
            });
        } catch (error) {
            this.logger.error('Failed to notify EC members of decision:', error);
            throw error;
        }
    }

    async notifyAspirantOfDecision(
        nominationId: string,
        decision: 'APPROVE' | 'REJECT' | null,
    ): Promise<void> {
        if (!decision) return;
        try {
            const nomination = await this.prisma.nomination.findUnique({
                where: { id: nominationId },
                include: { aspirant: true },
            });
            if (!nomination) throw new Error('Nomination not found');
            if (nomination.nomineeEmail) {
                await this.emailService.sendNominationStatusEmail(
                    nomination.nomineeEmail,
                    nomination.nomineeName,
                    decision,
                    // @ts-ignore
                    nomination.rejectionReason,
                );
            }
        } catch (error) {
            this.logger.error('Failed to notify aspirant of decision:', error);
            throw error;
        }
    }
}
