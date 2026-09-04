import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@tmb.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const adminName = process.env.ADMIN_NAME || 'TMB Admin';

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: UserRole.ADMIN,
    },
  });

  const sections = [
    { title: 'Trending Now', type: 'trending', order: 1, mode: 'AUTO' as const },
    { title: 'Popular Movies', type: 'popular', order: 2, mode: 'AUTO' as const },
    { title: 'Top Rated', type: 'top-rated', order: 3, mode: 'AUTO' as const },
    { title: 'Action Movies', type: 'genre', order: 4, mode: 'AUTO' as const, config: { genreId: 28 } },
  ];

  for (const section of sections) {
    const existing = await prisma.homepageSection.findFirst({
      where: { type: section.type, title: section.title },
    });
    if (!existing) {
      await prisma.homepageSection.create({ data: section });
    }
  }

  console.log('Seed completed. Admin:', adminEmail);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
