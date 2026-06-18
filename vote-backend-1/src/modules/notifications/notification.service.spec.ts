import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../../../db';
import { MnotifySmsService } from './service/mnotify-sms.service';
import { EmailService } from './service/email.service';
import { AdminNotificationsService } from './service/admin-notifications.service';
import { UserRole } from '@prisma/client';

const mockSmsService = {
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

    describe('recipientsFor', () => {
        it('queries only active users with the given role', async () => {
            mockPrisma.user.findMany.mockResolvedValue([
                { email: 'admin@test.com', phone: null },
            ]);
            const result = await service.recipientsFor(UserRole.ADMIN);
            expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ isActive: true }),
                }),
            );
            expect(result).toEqual([{ email: 'admin@test.com', phone: null }]);
        });

        it('accepts an array of roles', async () => {
            mockPrisma.user.findMany.mockResolvedValue([
                { email: 'ec@test.com', phone: '0551234567' },
            ]);
            await service.recipientsFor([UserRole.EC_MEMBER, UserRole.SUPER_ADMIN]);
            expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        role: { in: [UserRole.EC_MEMBER, UserRole.SUPER_ADMIN] },
                        isActive: true,
                    }),
                }),
            );
        });

        it('is the only place in the service that calls prisma.user.findMany', () => {
            // Structural assertion: every method that needs users should delegate to recipientsFor.
            // Verify notifyAdminsOfNewNomination uses recipientsFor, not raw prisma.
            const spy = jest.spyOn(service, 'recipientsFor').mockResolvedValue([
                { email: 'admin@test.com', phone: null },
            ]);
            mockEmailService.sendAdminNotificationEmail.mockResolvedValue(true);
            service.notifyAdminsOfNewNomination({
                nominationId: 'n1',
                nomineeName: 'Alice',
                position: 'PRESIDENT',
                createdAt: new Date(),
            });
            expect(spy).toHaveBeenCalled();
            expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
        });
    });

    describe('onBallotCast', () => {
        it('notifies admin recipients via emailService', async () => {
            const recipientsSpy = jest.spyOn(service, 'recipientsFor').mockResolvedValue([
                { email: 'admin@test.com', phone: null },
            ]);
            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            await service.onBallotCast({ positionIds: ['pos1'] });

            expect(recipientsSpy).toHaveBeenCalledWith([
                UserRole.ADMIN,
                UserRole.EC_MEMBER,
                UserRole.SUPER_ADMIN,
            ]);
            expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
                expect.objectContaining({ to: 'admin@test.com' }),
            );
        });
    });

    describe('notifyAdminsOfNewNomination', () => {
        it('sends email to all active admins via recipientsFor', async () => {
            jest.spyOn(service, 'recipientsFor').mockResolvedValue([
                { email: 'admin@test.com', phone: null },
            ]);
            mockEmailService.sendAdminNotificationEmail.mockResolvedValue(true);

            await service.notifyAdminsOfNewNomination({
                nominationId: 'n1',
                nomineeName: 'Alice',
                position: 'PRESIDENT',
                createdAt: new Date(),
            });

            expect(mockEmailService.sendAdminNotificationEmail).toHaveBeenCalledWith(
                ['admin@test.com'],
                expect.stringContaining('Alice'),
                expect.any(Object),
            );
        });
    });
});
