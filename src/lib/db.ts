import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Full query logging in production writes personal data (birth details,
    // chat text) into provider logs and costs throughput — keep it dev-only.
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
// prisma client revalidated (schema: ChatMessage.audioUrl, DailyCheckIn.microNote)
