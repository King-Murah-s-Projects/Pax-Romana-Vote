import { Body, Controller, HttpCode, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { StationIpGuard } from '../../common/guards/station-ip.guard';
import { VotingWindowGuard } from '../../common/guards/voting-window.guard';
import { UserRole } from '@prisma/client';
import { CheckinService } from './checkin.service';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

class CheckinDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsOptional()
  attestationReason?: string;
}

@Controller('voting/checkin')
@UseGuards(JwtAuthGuard, RolesGuard, StationIpGuard, VotingWindowGuard)
@Roles(UserRole.POLL_WORKER, UserRole.EC_MEMBER)
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Post()
  @HttpCode(200)
  async checkin(@Body() dto: CheckinDto, @Req() req: any) {
    const operator = req.user;
    const stationIp: string = req.ip ?? req.headers?.['x-forwarded-for'] ?? 'unknown';

    return this.checkinService.checkin({
      studentId: dto.studentId,
      operatorId: operator.id,
      operatorRole: operator.role,
      stationIp,
      attestationReason: dto.attestationReason,
    });
  }
}
