import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../users/users.service";
import { AdminLoginDto, RefreshTokenDto } from "./dto/login.dto";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { EmailService } from "../notifications/service/email.service";
import { AuthResponseDto, VerificationResponseDto } from "./dto/auth-response.dto";
import { UserRole } from '@prisma/client/index';
import {PrismaService} from "../../../db";
import { randomInt, timingSafeEqual } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private verificationCodes = new Map<string, { code: string; expires: Date; attempts: number }>();
  private readonly MAX_ATTEMPTS = 5;
  private readonly CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes
  private readonly RESEND_COOLDOWN = 60 * 1000; // 1 minute

  constructor(
      private jwtService: JwtService,
      private configService: ConfigService,
      private usersService: UsersService,
      private prisma: PrismaService,
      private notificationsService: EmailService
  ) {
    this.logger.log('AuthService initialized');
  }

  // Email-based verification code sending
  async sendVerificationCode(email: string, name?: string): Promise<{
    action: string;
    message: string;
    success: boolean;
    timeRemaining: number;
    verificationToken: string;
    reason: string;
    then: undefined
  }> {
    try {
      // Check if code was recently sent
      const existing = this.verificationCodes.get(email);
      if (existing && existing.expires > new Date()) {
        const timeRemaining = Math.ceil((existing.expires.getTime() - Date.now()) / 1000);
        if (timeRemaining > (this.CODE_EXPIRY - this.RESEND_COOLDOWN) / 1000) {
          return {
            action: 'decline' as const,
            message: 'Verification code already sent. Please wait before requesting a new one.',
            success: false,
            timeRemaining,
            verificationToken: '',
            reason: 'Rate limited',
            then: undefined,
          };
        }
      }

      // Generate 6-digit code (cryptographically secure; randomInt's upper bound is exclusive)
      const code = randomInt(100000, 1000000).toString();
      const expires = new Date(Date.now() + this.CODE_EXPIRY);

      // Store code
      this.verificationCodes.set(email, {
        code,
        expires,
        attempts: 0,
      });

      // Send email verification code first (non-blocking)
      await this.notificationsService.sendEmail({
          to: email,
          subject: 'Pax Romana KNUST - Verification Code',
          text: `Your verification code is: ${code}. Valid for 10 minutes.`,
      });

      // SECURITY: do NOT create users or assign roles here. This endpoint is
      // unauthenticated, so the previous behaviour — creating a user with
      // role: SUPER_ADMIN for any submitted email+name — was a privilege-escalation
      // hole that let anyone mint a super-admin. Admin accounts must be provisioned
      // out-of-band (DB seed, or an existing SUPER_ADMIN inviting them). Login
      // (verifyEmailAndLogin / adminLogin) already requires a pre-existing admin role,
      // so a code sent to a non-admin grants nothing. The `name` param is intentionally
      // unused now and kept only for request-shape compatibility.
      void name;

      this.logger.log(`Verification code sent to ${email}`);
      return {
        action: 'approve' as const,
        message: 'Verification code sent successfully',
        success: true,
        timeRemaining: this.CODE_EXPIRY / 1000,
        verificationToken: '', // Not used in this flow
        reason: 'Code sent successfully',
        then: undefined,
      };
    } catch (error) {
      this.logger.error(`Error sending verification code to ${email}:`, error);
      throw new BadRequestException('Failed to send verification code. Please try again.');
    }
  }

  // Email-based verification and login
  async verifyEmailAndLogin(email: string, verificationCode: string): Promise<{
    access_token: string;
    refresh_token: string;
    user: { id: any; name: any; email: any; role: any; emailVerified: boolean; isActive: any }
  }> {
    const storedData = this.verificationCodes.get(email);

    if (!storedData) {
      throw new UnauthorizedException('No verification code found. Please request a new code.');
    }

    if (storedData.expires < new Date()) {
      this.verificationCodes.delete(email);
      throw new UnauthorizedException('Verification code has expired. Please request a new code.');
    }

    if (storedData.attempts >= this.MAX_ATTEMPTS) {
      this.verificationCodes.delete(email);
      throw new UnauthorizedException('Maximum verification attempts exceeded. Please request a new code.');
    }

    if (!this.codesMatch(storedData.code, verificationCode)) {
      storedData.attempts++;
      throw new UnauthorizedException(`Invalid verification code. ${this.MAX_ATTEMPTS - storedData.attempts} attempts remaining.`);
    }

    // Code is valid, clean up
    this.verificationCodes.delete(email);

    try {
      // Get user
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        throw new UnauthorizedException('User not found. Please try logging in again.');
      }

      // Check if user has admin privileges
      const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.EC_MEMBER, UserRole.ADMIN];
      if (!allowedRoles.includes(user.role)) {
        throw new UnauthorizedException('Access denied. Admin privileges required.');
      }

      // Update verification status and last login in separate operations to avoid transaction timeouts
      try {
        await this.usersService.updateEmailVerificationStatus(user.id, true);
      } catch (error) {
        this.logger.warn(`Failed to update email verification status for user ${user.id}:`, error);
      }

      try {
        await this.usersService.updateLastLogin(user.id);
      } catch (error) {
        this.logger.warn(`Failed to update last login for user ${user.id}:`, error);
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      this.logger.log(`User ${email} logged in successfully via email verification`);

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: true,
          isActive: user.isActive,
        },
      };
    } catch (error) {
      this.logger.error(`Error during email verification login for ${email}:`, error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Login failed. Please try again.');
    }
  }

  // Direct admin login with email/password
  async adminLogin(adminLoginDto: AdminLoginDto): Promise<{
    access_token: string;
    refresh_token: string;
    user: { id: any; name: any; email: any; role: any; emailVerified: any; isActive: any }
  }> {
    const { email, password } = adminLoginDto;

    try {
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check admin privileges
      const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.EC_MEMBER, UserRole.ADMIN];
      if (!allowedRoles.includes(user.role)) {
        throw new UnauthorizedException('Access denied. Admin privileges required.');
      }

      // Check if an account is active
      if (!user.isActive) {
        throw new UnauthorizedException('Account has been suspended. Please contact support.');
      }

      // Check password
      if (!user.password) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Update last login (non-blocking)
      try {
        await this.usersService.updateLastLogin(user.id);
      } catch (error) {
        this.logger.warn(`Failed to update last login for user ${user.id}:`, error);
        // Don't fail login if this update fails
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      this.logger.log(`Admin ${email} logged in successfully`);

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
          isActive: user.isActive,
        },
      };
    } catch (error) {
      this.logger.error(`Error during admin login for ${email}:`, error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Login failed. Please try again.');
    }
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<{ access_token: string }> {
    try {
      const payload = this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Account has been suspended');
      }

      const access_token = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      });

      return { access_token };
    } catch (error) {
      this.logger.error('Error refreshing token:', error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<{ message: string }> {
    this.logger.log(`User ${userId} logged out`);
    return { message: 'Logged out successfully' };
  }

  // Get user profile from token
  async getProfile(userId: string) {
    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      };
    } catch (error) {
      this.logger.error(`Error getting profile for user ${userId}:`, error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Failed to get user profile');
    }
  }

  // Validate admin credentials (for internal use)
  async validateAdminCredentials(email: string, password: string) {
    return this.usersService.validateAdminCredentials(email, password);
  }

  private async generateTokens(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: '1h', // Shorter expiry for security
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { access_token, refresh_token };
  }

  // Constant-time comparison of short codes to avoid timing side-channels.
  // The length check leaks only length, which is fixed (6 digits), so it reveals nothing.
  private codesMatch(expected: string, provided: string): boolean {
    const a = Buffer.from(expected ?? '', 'utf8');
    const b = Buffer.from(provided ?? '', 'utf8');
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  }

  // Cleanup expired verification codes (run periodically)
  cleanupExpiredCodes() {
    const now = new Date();
    for (const [email, data] of this.verificationCodes.entries()) {
      if (data.expires < now) {
        this.verificationCodes.delete(email);
      }
    }
    this.logger.log('Expired verification codes cleaned up');
  }

  // Request password reset
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    try {
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists
        return { message: 'If the email exists, a reset link has been sent.' };
      }

      // Generate reset token (cryptographically secure; randomInt's upper bound is exclusive)
      const resetToken = randomInt(100000, 1000000).toString();
      const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      // Store reset token
      this.verificationCodes.set(`reset_${email}`, {
        code: resetToken,
        expires,
        attempts: 0,
      });

      // Send reset email
      await this.notificationsService.sendEmail({
          to: email,
          subject: 'Pax Romana KNUST - Password Reset',
          text: `Your password reset code is: ${resetToken}. Valid for 30 minutes.`,
      });

      this.logger.log(`Password reset requested for ${email}`);
      return { message: 'If the email exists, a reset link has been sent.' };
    } catch (error) {
      this.logger.error(`Error requesting password reset for ${email}:`, error);
      return { message: 'If the email exists, a reset link has been sent.' };
    }
  }

  // Reset password with token
  async resetPassword(email: string, resetToken: string, newPassword: string): Promise<{ message: string }> {
    const storedData = this.verificationCodes.get(`reset_${email}`);

    if (!storedData || storedData.expires < new Date() || !this.codesMatch(storedData.code, resetToken)) {
      this.verificationCodes.delete(`reset_${email}`);
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    try {
      // Find user
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await this.usersService.update(user.id, { password: hashedPassword });

      // Clean up reset token
      this.verificationCodes.delete(`reset_${email}`);

      this.logger.log(`Password reset completed for ${email}`);
      return { message: 'Password reset successfully' };
    } catch (error) {
      this.logger.error(`Error resetting password for ${email}:`, error);
      this.verificationCodes.delete(`reset_${email}`);
      throw new UnauthorizedException('Failed to reset password. Please try again.');
    }
  }
}