import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export interface SeedInput {
  email: string;
  password: string;
  prisma: Pick<PrismaClient, 'user'>;
}

export async function buildSeedAdmin({ email, password, prisma }: SeedInput): Promise<void> {
  if (!email) throw new Error('SEED_ADMIN_EMAIL is required');
  if (!password) throw new Error('SEED_ADMIN_PASSWORD is required');
  if (password.length < 8) throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters');

  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    create: { email, name: 'Admin', password: hashed, role: UserRole.SUPER_ADMIN },
    update: { password: hashed, role: UserRole.SUPER_ADMIN },
  });
}

// Entry point — only runs when invoked directly (not when imported by tests).
if (require.main === module) {
  const email = process.env.SEED_ADMIN_EMAIL ?? '';
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';
  const prisma = new PrismaClient();

  buildSeedAdmin({ email, password, prisma })
    .then(() => {
      console.log(`SUPER_ADMIN seeded: ${email}`);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
