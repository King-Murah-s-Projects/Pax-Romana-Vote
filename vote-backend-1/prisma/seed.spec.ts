import { buildSeedAdmin, SeedInput } from './seed';

// Minimal Prisma mock — only the methods seed uses.
const makePrisma = (existing?: any) => ({
  user: {
    upsert: jest.fn().mockResolvedValue({ id: '1', email: 'a@b.com', role: 'SUPER_ADMIN' }),
    findUnique: jest.fn().mockResolvedValue(existing ?? null),
  },
});

describe('buildSeedAdmin', () => {
  it('throws when SEED_ADMIN_EMAIL is missing', async () => {
    const prisma = makePrisma();
    const input: SeedInput = { email: '', password: 'secret123', prisma: prisma as any };
    await expect(buildSeedAdmin(input)).rejects.toThrow('SEED_ADMIN_EMAIL');
  });

  it('throws when SEED_ADMIN_PASSWORD is missing', async () => {
    const prisma = makePrisma();
    const input: SeedInput = { email: 'admin@pax.com', password: '', prisma: prisma as any };
    await expect(buildSeedAdmin(input)).rejects.toThrow('SEED_ADMIN_PASSWORD');
  });

  it('throws when password is shorter than 8 characters', async () => {
    const prisma = makePrisma();
    const input: SeedInput = { email: 'admin@pax.com', password: 'short', prisma: prisma as any };
    await expect(buildSeedAdmin(input)).rejects.toThrow(/8 characters/);
  });

  it('upserts a SUPER_ADMIN on first run', async () => {
    const prisma = makePrisma();
    const input: SeedInput = { email: 'admin@pax.com', password: 'secret123', prisma: prisma as any };
    await buildSeedAdmin(input);
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'admin@pax.com' },
        create: expect.objectContaining({ role: 'SUPER_ADMIN' }),
        update: expect.objectContaining({ role: 'SUPER_ADMIN' }),
      }),
    );
  });

  it('is idempotent — upsert is called once regardless of whether the user exists', async () => {
    const prisma = makePrisma({ id: '1', email: 'admin@pax.com' });
    const input: SeedInput = { email: 'admin@pax.com', password: 'secret123', prisma: prisma as any };
    await buildSeedAdmin(input);
    expect(prisma.user.upsert).toHaveBeenCalledTimes(1);
  });

  it('stores a bcrypt hash, not the plaintext password', async () => {
    let stored: string | undefined;
    const prisma = {
      user: {
        upsert: jest.fn().mockImplementation(async ({ create }) => {
          stored = create.password;
          return { id: '1' };
        }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    await buildSeedAdmin({ email: 'admin@pax.com', password: 'secret123', prisma: prisma as any });
    expect(stored).toBeDefined();
    expect(stored).not.toBe('secret123');
    expect(stored).toMatch(/^\$2[ab]\$/); // bcrypt prefix
  });
});
