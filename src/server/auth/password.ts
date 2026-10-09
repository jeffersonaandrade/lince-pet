import 'server-only'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

/** Mesma configuração de config/hash.ts do Adonis: os hashes existentes continuam válidos. */
const scrypt = new Scrypt({
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
  maxMemory: 33554432,
})

export const hashPassword = (plain: string) => scrypt.make(plain)

export async function verifyPassword(hashed: string, plain: string) {
  try {
    return await scrypt.verify(hashed, plain)
  } catch {
    return false
  }
}
