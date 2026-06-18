import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Candidate_Position, ResultCertification } from '@prisma/client';
import { PrismaService } from '../../../../db';
import { TallyService } from './tally.service';

@Injectable()
export class CertificationService {
  private readonly logger = new Logger(CertificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tallyService: TallyService,
  ) {}

  async certifyPosition(
    position: Candidate_Position,
    certifiedById: string,
    notes?: string,
  ): Promise<ResultCertification> {
    const tallySnapshot = await this.tallyService.computeTally(position);
    try {
      const cert = await this.prisma.resultCertification.create({
        data: { position, certifiedById, tallySnapshot: tallySnapshot as any, notes },
      });
      this.logger.log(`Position ${position} certified by ${certifiedById}`);
      return cert;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(`Position ${position} is already certified`);
      }
      throw err;
    }
  }

  async getCertification(position: Candidate_Position): Promise<ResultCertification | null> {
    return this.prisma.resultCertification.findUnique({ where: { position } });
  }

  async listCertifications(): Promise<ResultCertification[]> {
    return this.prisma.resultCertification.findMany({ orderBy: { certifiedAt: 'asc' } });
  }

  async getCertificationHistory(): Promise<ResultCertification[]> {
    return this.listCertifications();
  }

  async isElectionFullyCertified(): Promise<boolean> {
    const { Candidate_Position: positions } = await import('@prisma/client');
    const count = await this.prisma.resultCertification.count();
    return count >= Object.keys(positions).length;
  }
}
