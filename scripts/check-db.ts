import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const users = await db.user.findMany({ select: { email: true, isGuest: true, _count: { select: { birthCharts: true, chatHistory: true, checkIns: true } } } });
console.log(JSON.stringify(users, null, 1));
await db.$disconnect();
