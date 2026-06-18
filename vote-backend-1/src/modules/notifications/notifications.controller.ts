import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client/index";

@Controller('notifications/test')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class NotificationTestController {
  constructor(private notificationsService: NotificationService) {}

  @Post('sms')
  async testSms(@Body() body: { phoneNumber: string; message: string }) {
    return this.notificationsService.sendSms(body.phoneNumber, body.message);
  }

  @Post('email')
  async testEmail(@Body() body: { email: string; subject: string; message: string }) {
    return this.notificationsService.sendEmail(body.email, body.subject, body.message);
  }

  @Post('verification-code')
  async testVerificationCode(@Body() body: { phoneNumber: string }) {
    const code = '123456';
    return this.notificationsService.sendVerificationCode(body.phoneNumber, code);
  }
}
