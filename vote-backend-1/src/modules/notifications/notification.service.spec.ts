import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../../../db';
import { MnotifySmsService } from './service/mnotify-sms.service';
import { EmailService } from './service/email.service';
import { AdminNotificationsService } from './service/admin-notifications.service';

const mockSmsService = {
    sendSms: jest.fn(),
    sendVerificationCode: jest.fn(),
    sendNominationStatusUpdate: jest.fn(),
};
const mockEmailService = {
    sendEmail: jest.fn(),
    sendNominationStatusEmail: jest.fn(),
    sendAdminNotificationEmail: jest.fn(),
    sendVerificationCompleteEmail: jest.fn(),
};
const mockPrisma = {
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    nomination: { findUnique: jest.fn() },
};
const mockAdminNotificationsService = {
    notifyNominationReady: jest.fn(),
    notifyEcMemberOfDecision: jest.fn(),
};

describe('NotificationService', () => {
    let service: NotificationService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationService,
                { provide: MnotifySmsService, useValue: mockSmsService },
                { provide: EmailService, useValue: mockEmailService },
                { provide: PrismaService, useValue: mockPrisma },
                { provide: AdminNotificationsService, useValue: mockAdminNotificationsService },
            ],
        }).compile();
        service = module.get<NotificationService>(NotificationService);
        jest.clearAllMocks();
    });

    describe('sendSms', () => {
        it('returns true on success', async () => {
            mockSmsService.sendSms.mockResolvedValue({ success: true });
            const result = await service.sendSms('0551234567', 'Test message');
            expect(result).toBe(true);
        });

        it('throws on SMS failure', async () => {
            mockSmsService.sendSms.mockResolvedValue({ success: false, error: 'Network error' });
            await expect(service.sendSms('0551234567', 'Test')).rejects.toThrow('Failed to send SMS');
        });
    });

    describe('sendEmail', () => {
        it('returns true on success', async () => {
            mockEmailService.sendEmail.mockResolvedValue({ success: true });
            const result = await service.sendEmail('a@b.com', 'Subject', '<p>Body</p>');
            expect(result).toBe(true);
        });

        it('returns false on email error', async () => {
            mockEmailService.sendEmail.mockRejectedValue(new Error('SMTP error'));
            const result = await service.sendEmail('a@b.com', 'Subject', '<p>Body</p>');
            expect(result).toBe(false);
        });
    });

    describe('notifyAdminsOfNewNomination', () => {
        it('sends email to all active admins', async () => {
            mockPrisma.user.findMany.mockResolvedValue([{ email: 'admin@test.com' }]);
            mockEmailService.sendAdminNotificationEmail.mockResolvedValue(true);

            await service.notifyAdminsOfNewNomination({
                nominationId: 'n1', nomineeName: 'Alice', position: 'PRESIDENT', createdAt: new Date(),
            });

            expect(mockEmailService.sendAdminNotificationEmail).toHaveBeenCalledWith(
                ['admin@test.com'],
                expect.stringContaining('Alice'),
                expect.any(Object),
            );
        });
    });
});
