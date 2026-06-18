import { Test, TestingModule } from '@nestjs/testing';
import { NotificationTestController } from './notifications.controller';
import { MnotifySmsService } from './service/mnotify-sms.service';
import { EmailService } from './service/email.service';

describe('NotificationsController', () => {
  let controller: NotificationTestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationTestController],
      providers: [
        { provide: MnotifySmsService, useValue: { sendSms: jest.fn() } },
        { provide: EmailService, useValue: { sendEmail: jest.fn() } },
      ],
    }).compile();

    controller = module.get<NotificationTestController>(NotificationTestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
