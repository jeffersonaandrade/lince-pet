import { describe, it, expect, beforeAll } from 'vitest'
import jsonwebtoken from 'jsonwebtoken'
import { generateToken, verifyToken } from '@/server/auth/jwt'
import { hashPassword, verifyPassword } from '@/server/auth/password'

const APP_KEY = 'test-app-key-with-enough-length-1234'

beforeAll(() => {
  process.env.APP_KEY = APP_KEY
})

describe('JWT compatível com o Adonis (jsonwebtoken HS256 + APP_KEY)', () => {
  it('aceita token emitido pelo Adonis', async () => {
    const adonisToken = jsonwebtoken.sign(
      { userId: 'uuid-1', entityId: 7, nome: 'Ana', sobrenome: 'Lima', userType: 'tutor' },
      APP_KEY,
      { expiresIn: '30d' }
    )
    const payload = await verifyToken(adonisToken)
    expect(payload).toMatchObject({ userId: 'uuid-1', entityId: 7, userType: 'tutor' })
  })

  it('emite token que o Adonis aceita', async () => {
    const token = await generateToken({ id: 'uuid-2', nome: 'Bia', sobrenome: null, userType: 'veterinario', entityId: 3 })
    const decoded = jsonwebtoken.verify(token, APP_KEY) as any
    expect(decoded).toMatchObject({ userId: 'uuid-2', entityId: 3, userType: 'veterinario' })
  })

  it('rejeita token com outro segredo', async () => {
    const forged = jsonwebtoken.sign({ userId: 'x', userType: 'tutor' }, 'outro-segredo')
    expect(await verifyToken(forged)).toBeNull()
  })
})

describe('Senha scrypt (mesmo formato PHC do Adonis)', () => {
  it('gera e verifica hash', async () => {
    const hash = await hashPassword('Senha@123')
    expect(hash.startsWith('$scrypt$n=16384,r=8,p=1$')).toBe(true)
    expect(await verifyPassword(hash, 'Senha@123')).toBe(true)
    expect(await verifyPassword(hash, 'errada')).toBe(false)
  })

  it('retorna false para hash inválido', async () => {
    expect(await verifyPassword('nao-e-hash', 'x')).toBe(false)
  })
})
