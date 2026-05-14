import { Injectable, Logger } from '@nestjs/common';
import { MnotifySmsService } from './service/mnotify-sms.service';
import { EmailService } from './service/email.service';
import { AdminNotificationsService } from './service/admin-notifications.service';
import { PrismaService } from '../../../db';
import { AdminActions } from "../common/enums/nomination-status.enum";
import {UserRole, NominatorVerification, Candidate_Position} from "@prisma/client/index";

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private notifySmsService: MnotifySmsService,
        private emailService: EmailService,
        private prisma: PrismaService,
        private adminNotificationsService: AdminNotificationsService,
    ) {}

    // SMS Methods
    async sendSms(to: string, message: string): Promise<boolean> {
        const result = await this.notifySmsService.sendSms({ to, message });
        if (!result.success) {
            this.logger.error(`Failed to send SMS to ${to}: ${result.error}`);
            throw new Error(`Failed to send SMS: ${result.error}`);
        }
        return true;
    }

    async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
        const result = await this.notifySmsService.sendVerificationCode(phoneNumber, code);
        if (!result) {
            this.logger.error(`Failed to send verification code to ${phoneNumber}`);
            throw new Error('Failed to send verification code');
        }
        return true;
    }

    // Email Methods
    async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
        try {
            const result = await this.emailService.sendEmail({ to, subject, html });
            return result.success;
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}:`, error);
            return false;
        }
    }

    async sendTemplateEmail(to: string, subject: string, template: string, data: any): Promise<boolean> {
        try {
            const result = await this.emailService.sendEmail({
                to,
                subject,
                template,
                templateData: data
            });
            return result.success;
        } catch (error) {
            this.logger.error(`Failed to send template email to ${to}:`, error);
            return false;
        }
    }

    async notifyNominationStatusChange(
        nominationData: any,
        status: string,
        reason?: string
    ): Promise<void> {
        try {
            // Email notification
            await this.emailService.sendNominationStatusEmail(
                nominationData.nominee.email,
                nominationData.nominee.name,
                status,
                reason
            );

            // SMS notification
            await this.notifySmsService.sendNominationStatusUpdate(
                nominationData.nominee.phoneNumber,
                nominationData.nominee.name,
                status,
                //@ts-ignore
                reason
            );
        } catch (error) {
            this.logger.error('Failed to send nomination status change notification:', error);
            throw error;
        }
    }

    // Admin notifications
    async notifyAdminsOfNewNomination(data: {
        nominationId: string;
        nomineeName: string;
        position: string;
        createdAt: Date;
    }) {
        const admins = await this.prisma.user.findMany({
            where: { role: { in: [UserRole.ADMIN, UserRole.EC_MEMBER, UserRole.SUPER_ADMIN] }, isActive: true },
            select: { email: true },
        });

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
            this.logger.error(`Failed to send admin notification`, error);
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

    // Verification-specific methods for guarantor and nominator services
    async sendNominatorVerificationEmail(data: {
        nomination: { nomineeName: string; nomineePosition: Candidate_Position };
        nominatorEmail: string;
        nominatorName: string;
        token: string;
    }) {
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

    // Add this method to your NotificationsService
    async notifyEcMembersOfDecision(nominationId: string, reviewerId: string, action: AdminActions): Promise<void> {
        try {
            const nomination = await this.prisma.nomination.findUnique({
                where: { id: nominationId },
                include: {
                    aspirant: true,
                },
            });

            if (!nomination) {
                throw new Error('Nomination not found');
            }

            const ecMembers = await this.prisma.user.findMany({
                where: {
                    role: { in: [UserRole.ADMIN, UserRole.EC_MEMBER, UserRole.SUPER_ADMIN] },
                    id: { not: reviewerId },
                    isActive: true,
                },
            });

            const reviewer = await this.prisma.user.findUnique({
                where: { id: reviewerId },
                select: { name: true },
            });

            await this.adminNotificationsService.notifyEcMemberOfDecision({
                ecMemberEmails: ecMembers.map((m) => m.email).filter(Boolean) as string[],
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

    // Notify aspirants of final decisions
    async notifyAspirantOfDecision(nominationId: string, decision: 'APPROVE' | 'REJECT' | null): Promise<void> {
        if (!decision) return;

        try {
            const nomination = await this.prisma.nomination.findUnique({
                where: { id: nominationId },
                include: {
                    aspirant: true,
                },
            });

            if (!nomination) {
                throw new Error('Nomination not found');
            }

            if (nomination.nomineeEmail) {
                await this.emailService.sendNominationStatusEmail(
                    nomination.nomineeEmail,
                    nomination.nomineeName,
                    decision,
                    //@ts-ignore
                    nomination.rejectionReason,
                );
            }
        } catch (error) {
            this.logger.error('Failed to notify aspirant of decision:', error);
            throw error;
        }
    }

    async sendGuarantorVerificationEmail(data: {
        nomination: { nomineeName: string; nomineePosition: string };
        guarantorName: string;
        guarantorEmail: string;
        token: string;
    }) {
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

    // Notification for verification completion
    async notifyNominationVerificationComplete(data: {
        nominee: { name: string; email: string; phoneNumber: string };
        position: string;
        createdAt: Date;
    }) {
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


    // Deadline notifications
    async sendDeadlineReminder(
        to: string,
        type: 'email' | 'sms',
        hoursLeft: number
    ): Promise<boolean> {
        try {
            const message = `Reminder: Nomination deadline in ${hoursLeft} hours. Submit your nomination before it's too late!`;

            if (type === 'email') {
                return await this.sendEmail(
                    to,
                    'Nomination Deadline Reminder',
                    `<p>${message}</p>`
                );
            } else {
                return await this.sendSms(to, message);
            }
        } catch (error) {
            this.logger.error(`Failed to send deadline reminder to ${to}:`, error);
            return false;
        }
    }

    // EC-specific notifications
    async sendECNotificationEmail(
        email: string,
        nominationId: string
    ): Promise<boolean> {
        try {
            // Get nomination details for the email
            const nomination = await this.getNominationDetails(nominationId);


            //@ts-ignore
            return await this.emailService.sendEmail({
                to: email,
                subject: 'New Nomination Ready for Review',
                template: 'ec-notification',
                templateData: {
                    nomineeName: nomination.nomineeName,
                    position: nomination.nomineePosition,
                    submissionDate: nomination.createdAt,
                    nominationId: nominationId,
                    reviewUrl: `${process.env.FRONTEND_URL}/admin/nominations/${nominationId}/review`
                }
            });
        } catch (error) {
            this.logger.error(`Failed to send EC notification email to ${email}:`, error);
            return false;
        }
    }

    async sendDecisionNotificationEmail(
        email: string,
        nomineeName: string,
        decision: 'APPROVED' | 'REJECTED',
        reason?: string
    ): Promise<boolean> {
        try {
            const subject = decision === 'APPROVED'
                ? 'Nomination Approved - Congratulations!'
                : 'Nomination Decision Update';

            //@ts-ignore
            return await this.emailService.sendEmail({
                to: email,
                subject,
                template: 'nomination-decision',
                templateData: {
                    nomineeName,
                    decision,
                    reason,
                    isApproved: decision === 'APPROVED',
                    nextSteps: decision === 'APPROVED'
                        ? 'Your nomination has been approved and you are now a candidate. Good luck!'
                        : 'You may resubmit your nomination if you address the feedback provided.'
                }
            });
        } catch (error) {
            this.logger.error(`Failed to send decision notification email to ${email}:`, error);
            return false;
        }
    }

    // Bulk notifications
    async sendBulkNotifications(
        recipients: { email?: string; phone?: string }[],
        subject: string,
        message: string,
        type: 'email' | 'sms' | 'both' = 'both'
    ): Promise<{ success: number; failed: number }> {
        let success = 0;
        let failed = 0;

        for (const recipient of recipients) {
            try {
                if (type === 'email' || type === 'both') {
                    if (recipient.email) {
                        const result = await this.sendEmail(recipient.email, subject, message);
                        if (result) success++;
                        else failed++;
                    }
                }

                if (type === 'sms' || type === 'both') {
                    if (recipient.phone) {
                        const result = await this.sendSms(recipient.phone, message);
                        if (result) success++;
                        else failed++;
                    }
                }
            } catch (error) {
                this.logger.error(`Failed to send notification to recipient:`, error);
                failed++;
            }
        }

        return { success, failed };
    }


    private async getNominationDetails(nominationId: string): Promise<any> {
        try {
            const nomination = await this.prisma.nomination.findUnique({
                where: { id: nominationId },
                include: {
                    aspirant: true,
                },
            });

            if (!nomination) {
                throw new Error(`Nomination with ID ${nominationId} not found`);
            }

            return {
                nomineeName: nomination.nomineeName,
                nomineePosition: nomination.nomineePosition,
                createdAt: nomination.createdAt,
                aspirantName: nomination.aspirant.name,
                aspirantEmail: nomination.aspirant.email,
            };
        } catch (error) {
            this.logger.error(`Failed to get nomination details for ${nominationId}:`, error);
            throw error;
        }
    }
}