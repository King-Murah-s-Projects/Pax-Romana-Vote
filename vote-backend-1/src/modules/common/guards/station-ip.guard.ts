import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StationIpGuard implements CanActivate {
  private readonly logger = new Logger(StationIpGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.configService.get<string>('ALLOWED_STATION_IPS');
    if (!allowed || allowed.trim() === '') {
      this.logger.warn('ALLOWED_STATION_IPS is not set — all IPs permitted (dev mode)');
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const forwarded = req.headers?.['x-forwarded-for'];
    const clientIp: string = req.ip ?? (forwarded ? (forwarded as string).split(',')[0].trim() : '');

    const allowlist = allowed.split(',').map((ip: string) => ip.trim());
    if (allowlist.includes(clientIp)) return true;

    throw new ForbiddenException(`Request from ${clientIp} is not an allowed station IP`);
  }
}
