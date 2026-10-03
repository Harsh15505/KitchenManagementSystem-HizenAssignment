import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  for (let i = 0; i < 40; i++) {
    const days = await prisma.demoDay.findMany({ orderBy: { date: 'asc' } });
    const pending = days.filter((d) => d.ordersCreated === 0).length;
    if (days.length >= 22 && pending <= 3) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  const days = await prisma.demoDay.findMany({ orderBy: { date: 'asc' } });
  console.log(days.map((d) => `${d.date.toISOString().slice(5, 10)}:${d.ordersCreated}`).join(' '));
  const byStatus = await prisma.order.groupBy({ by: ['status'], _count: { _all: true } });
  console.log(byStatus.map((s) => `${s.status}=${s._count._all}`).join(' '), 'drops', await prisma.drop.count());
  await prisma.$disconnect();
}
void main();
