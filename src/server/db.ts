import 'server-only'
import { PrismaClient } from '@prisma/client'

/**
 * Campos com `serializeAs: null` no Lucid nunca saem do banco por padrão.
 * Para ler a senha (login), use `omit: { password: false }` na consulta.
 */
const createClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
    omit: {
      user: {
        password: true,
        googleAccessToken: true,
        googleRefreshToken: true,
        googleTokenExpiresAt: true,
      },
    },
  })

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> }

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
