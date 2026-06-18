import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../db';

interface RosterEntry {
  studentId: string;
  name: string;
}

@Injectable()
export class EligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async importRoster(entries: RosterEntry[]): Promise<void> {
    await this.prisma.eligibilityRoster.createMany({
      data: entries,
      skipDuplicates: true,
    });
  }

  async freezeRoster(): Promise<void> {
    await this.prisma.eligibilityRoster.updateMany({
      where: { frozen: false },
      data: { frozen: true },
    });
  }

  async isEligible(studentId: string): Promise<boolean> {
    const entry = await this.prisma.eligibilityRoster.findUnique({
      where: { studentId },
    });
    return entry !== null;
  }

  async recordParticipation(studentId: string): Promise<void> {
    try {
      await this.prisma.participationRecord.create({
        data: { studentId },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(`Student ${studentId} has already participated`);
      }
      throw err;
    }
  }
}
