import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../../db/db.service';
import { CheckinService } from '../checkin/checkin.service';

export interface BallotSelection {
  position: string;
  candidateId: string;
}

export interface CastInput {
  ballotToken: string;
  selections: BallotSelection[];
}

@Injectable()
export class BallotService {
  private readonly logger = new Logger(BallotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkinService: CheckinService,
  ) {}

  async cast(input: CastInput): Promise<{ success: true }> {
    const { ballotToken, selections } = input;

    if (!this.checkinService.isTokenValid(ballotToken)) {
      throw new UnauthorizedException('Invalid, expired, or already-used ballot token');
    }

    // Verify position integrity: each candidateId must belong to the stated position
    const candidateIds = selections.map((s) => s.candidateId);
    const candidates = await (this.prisma.candidate as any).findMany({
      where: { id: { in: candidateIds } },
      select: { id: true, position: true },
    });

    const candidateMap = new Map(candidates.map((c: any) => [c.id, c.position]));
    for (const sel of selections) {
      const actualPosition = candidateMap.get(sel.candidateId);
      if (!actualPosition) {
        throw new BadRequestException(`Candidate ${sel.candidateId} not found`);
      }
      if (actualPosition !== sel.position) {
        throw new BadRequestException(
          `Candidate ${sel.candidateId} does not belong to position ${sel.position}`,
        );
      }
    }

    // Consume token atomically — guards concurrent double-submit
    const consumed = this.checkinService.consumeToken(ballotToken);
    if (!consumed) {
      throw new UnauthorizedException('Ballot token was already used');
    }

    // Write all ballot rows in a single transaction
    await (this.prisma as any).$transaction(async (tx: any) => {
      await tx.ballot.createMany({
        data: selections.map((sel) => ({
          candidateId: sel.candidateId,
          position: sel.position,
        })),
      });
    });

    // ADR-0008: fire-and-forget domain event after commit
    this.logger.log(`ballot.cast positions=${selections.map((s) => s.position).join(',')}`);

    return { success: true };
  }
}
