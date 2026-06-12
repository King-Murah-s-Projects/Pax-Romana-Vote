import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
  BadRequestException
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminLoginDto, RefreshTokenDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { CurrentUser } from "./decorators/current-user.decorator";
import { IsEmail, IsString, MinLength } from 'class-validator';

// DTOs for the new email-based endpoints
class SendVerificationCodeDto {
  @IsEmail()
  email: string;

  @IsString()
  name?: string;
}

class VerifyEmailCodeDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  verificationCode: string;
}

class PasswordResetRequestDto {
  @IsEmail()
  email: string;
}

class PasswordResetDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  resetToken: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  // Send email verification code
  @Post('send-code')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async sendVerificationCode(@Body() dto: SendVerificationCodeDto): Promise<{
    action: string;
    message: string;
    success: boolean;
    timeRemaining: number;
    verificationToken: string;
    reason: string;
    then: undefined
  }> {
    try {
      return await this.authService.sendVerificationCode(dto.email, dto.name);
    } catch (error) {
      this.logger.error('Failed to send verification code:', error);
      throw error;
    }
  }

  // Verify email code and login
  @Post('verify-email')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async verifyEmailAndLogin(@Body() dto: VerifyEmailCodeDto): Promise<{
    access_token: string;
    refresh_token: string;
    user: { id: any; name: any; email: any; role: any; emailVerified: boolean; isActive: any }
  }> {
    try {
      return await this.authService.verifyEmailAndLogin(dto.email, dto.verificationCode);
    } catch (error) {
      this.logger.error('Failed to verify email and login:', error);
      throw error;
    }
  }

  // Direct admin login with email/password
  @Post('admin-login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async adminLogin(@Body() adminLoginDto: AdminLoginDto): Promise<{
    access_token: string;
    refresh_token: string;
    user: { id: any; name: any; email: any; role: any; emailVerified: any; isActive: any }
  }> {
    try {
      return await this.authService.adminLogin(adminLoginDto);
    } catch (error) {
      this.logger.error('Failed admin login:', error);
      throw error;
    }
  }

  // Refresh token
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<{ access_token: string }> {
    try {
      return await this.authService.refreshToken(refreshTokenDto);
    } catch (error) {
      this.logger.error('Failed to refresh token:', error);
      throw error;
    }
  }

  // Logout
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: any): Promise<{ message: string }> {
    try {
      return await this.authService.logout(user.id);
    } catch (error) {
      this.logger.error('Failed to logout:', error);
      throw error;
    }
  }

  // Get user profile
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: any) {
    try {
      return await this.authService.getProfile(user.id);
    } catch (error) {
      this.logger.error('Failed to get profile:', error);
      throw error;
    }
  }

  // Request password reset
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto): Promise<{ message: string }> {
    try {
      return await this.authService.requestPasswordReset(dto.email);
    } catch (error) {
      this.logger.error('Failed to request password reset:', error);
      throw error;
    }
  }

  // Reset password with token
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: PasswordResetDto): Promise<{ message: string }> {
    try {
      return await this.authService.resetPassword(dto.email, dto.resetToken, dto.newPassword);
    } catch (error) {
      this.logger.error('Failed to reset password:', error);
      throw error;
    }
  }

  // Health check endpoint
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'auth',
    };
  }
}