import { describe, it, expect } from 'vitest'
import { contractCases, type ContractCase } from './cases'

/**
 * Testes de contrato: a mesma requisição vai para o Adonis (CONTRACT_ADONIS_URL)
 * e para o Next (CONTRACT_NEXT_URL, ex. http://localhost:3000/api), e as respostas
 * são comparadas (status + formato do JSON; valores quando `exact`).
 *
 * Tokens por perfil: CONTRACT_TOKEN_TUTOR / CONTRACT_TOKEN_VETERINARIO / CONTRACT_TOKEN_CLINICA
 * IDs usados nos paths: CONTRACT_VET_ID, CONTRACT_CLINICA_ID, CONTRACT_PET_ID, ...
 * Casos com escrita só rodam com CONTRACT_ALLOW_WRITES=1 (use um banco de staging).
 */

const ADONIS = process.env.CONTRACT_ADONIS_URL?.replace(/\/+$/, '')
const NEXT = process.env.CONTRACT_NEXT_URL?.replace(/\/+$/, '')
const allowWrites = process.env.CONTRACT_ALLOW_WRITES === '1'

function fillPath(path: string) {
  return path.replace(/:([a-zA-Z]+)/g, (_, name: string) => {
    const key = `CONTRACT_${name.replace(/([A-Z])/g, '_$1').toUpperCase()}`
    const value = process.env[key]
    if (!value) throw new Error(`Defina ${key} para testar ${path}`)
    return value
  })
}

async function call(base: string, c: ContractCase) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (c.as) {
    const token = process.env[`CONTRACT_TOKEN_${c.as.toUpperCase()}`]
    if (!token) throw new Error(`Defina CONTRACT_TOKEN_${c.as.toUpperCase()}`)
    headers.Authorization = `Bearer ${token}`
  }
  if (c.body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${base}${fillPath(c.path)}`, {
    method: c.method,
    headers,
    body: c.body ? JSON.stringify(c.body) : undefined,
    redirect: 'manual',
  })
  const text = await res.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {}
  return { status: res.status, body }
}

/** Reduz um JSON ao seu "formato": tipos por chave, recursivo (arrays usam o 1º item). */
export function shape(value: unknown): unknown {
  if (value === null) return 'null'
  if (Array.isArray(value)) return value.length ? [shape(value[0])] : []
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((k) => [k, shape((value as any)[k])])
    )
  }
  return typeof value
}

const enabled = Boolean(ADONIS && NEXT)

describe.skipIf(!enabled)('Contrato Adonis x Next', () => {
  for (const c of contractCases) {
    const skip = c.write && !allowWrites
    it.skipIf(skip)(`${c.method} ${c.path}${c.as ? ` (${c.as})` : ''}`, async () => {
      const [a, n] = await Promise.all([call(ADONIS!, c), call(NEXT!, c)])
      expect(n.status, 'status').toBe(a.status)
      if (c.exact) expect(n.body).toEqual(a.body)
      else expect(shape(n.body)).toEqual(shape(a.body))
    })
  }
})
