import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VotingWindowGuard implements CanActivate {
  private readonly logger = new Logger(VotingWindowGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const start = this.configService.get<string>('VOTING_START');
    const end = this.configService.get<string>('VOTING_END');

    if (!start || !end) {
      this.logger.warn('VOTING_START/VOTING_END not set — voting window unrestricted (dev mode)');
      return true;
    }

    const now = Date.now();
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();

    if (now >= startMs && now <= endMs) return true;

    throw new ForbiddenException('Voting is not currently open');
  }
}
