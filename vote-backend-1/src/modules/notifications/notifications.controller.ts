import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { MnotifySmsService } from './service/mnotify-sms.service';
import { EmailService } from './service/email.service';
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client/index";

@Controller('notifications/test')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class NotificationTestController {
  constructor(
    private smsService: MnotifySmsService,
    private emailService: EmailService,
  ) {}

  @Post('sms')
  async testSms(@Body() body: { phoneNumber: string; message: string }) {
    return this.smsService.sendSms({ to: body.phoneNumber, message: body.message });
  }

  @Post('email')
  async testEmail(@Body() body: { email: string; subject: string; message: string }) {
    return this.emailService.sendEmail({ to: body.email, subject: body.subject, text: body.message });
  }
}
