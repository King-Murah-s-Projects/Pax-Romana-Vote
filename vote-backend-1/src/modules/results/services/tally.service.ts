import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Candidate_Position } from '@prisma/client';
import { PrismaService } from '../../../../db';

export interface TallyResult {
  candidateId: string;
  candidateName: string;
  position: Candidate_Position;
  ballotCount: number;
}

@Injectable()
export class TallyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private assertVotingClosed(): void {
    const votingEnd = this.configService.get<string>('VOTING_END');
    if (!votingEnd) return; // dev mode — allow
    if (new Date(votingEnd) > new Date()) {
      throw new ForbiddenException('Voting has not closed yet');
    }
  }

  async computeTally(position?: Candidate_Position): Promise<TallyResult[]> {
    this.assertVotingClosed();

    const where = position ? { position } : {};

    const grouped = await this.prisma.ballot.groupBy({
      by: ['candidateId', 'position'],
      where,
      _count: { candidateId: true },
    });

    if (grouped.length === 0) return [];

    const candidateIds = grouped.map((g) => g.candidateId);
    const candidates = await this.prisma.candidate.findMany({
      where: { id: { in: candidateIds } },
    });

    const candidateMap = new Map(candidates.map((c) => [c.id, c]));

    return grouped.map((g) => ({
      candidateId: g.candidateId,
      candidateName: candidateMap.get(g.candidateId)?.name ?? 'Unknown',
      position: g.position,
      ballotCount: g._count.candidateId,
    }));
  }

  async getTurnout(): Promise<{ participationCount: number }> {
    const participationCount = await this.prisma.participationRecord.count();
    return { participationCount };
  }
}
