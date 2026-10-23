// Testes sem bundler nativo: podem rodar offline em Linux com as dependências locais do Windows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import ts from 'typescript'

const loadNode = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
class HttpError extends Error {
  constructor(status, body) { super(body.message); this.status = status; this.body = body }
}

function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const mod = { exports: {} }
  const dependency = (name) => {
    if (name === 'server-only') return {}
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name.startsWith('node:')) return loadNode(name)
    throw new Error(`Dependência não isolada: ${name}`)
  }
  new Function('require', 'module', 'exports', js)(dependency, mod, mod.exports)
  return mod.exports
}

const lucid = { updating: (data) => data, creating: (data) => ({ id: 'dummy-id', ...data }) }

test('redirecionamentos normalizados continuam na origem do app', () => {
  const { destinoSeguro } = load('src/lib/destino-login.ts')
  for (const input of ['/.//evil.test', '/a/..//evil.test', '/%2e//evil.test', '//evil.test', '/\\evil.test']) {
    assert.equal(destinoSeguro(input), '/')
  }
  assert.equal(destinoSeguro('/dashboard?aba=pets#lista'), '/dashboard?aba=pets#lista')
})

test('login recusa formulário cross-site, Origin null e origem forjada', () => {
  const { exigirMesmaOrigem } = load('src/server/auth/origin.ts', { '../http': { HttpError } })
  const req = (headers) => ({ url: 'https://app.example.test/api/auth/login', headers: new Headers(headers) })
  for (const headers of [{ origin: 'https://evil.test' }, { origin: 'null' }, { 'sec-fetch-site': 'cross-site' }]) {
    assert.throws(() => exigirMesmaOrigem(req(headers)), { status: 403 })
  }
  assert.doesNotThrow(() => exigirMesmaOrigem(req({ origin: 'https://app.example.test' })))
  assert.doesNotThrow(() => exigirMesmaOrigem(req({})))
})

test('horários alternativos não contornam ocupação e bloqueios', () => {
  const { horarioCanonico } = load('src/server/services/agenda-lock.ts')
  for (const input of ['9:00', '09:00 ', '24:00', '09:60', '09:00:00']) assert.equal(horarioCanonico(input), false)
  for (const input of ['00:00', '09:00', '23:59']) assert.equal(horarioCanonico(input), true)
})

function pushService(db, sendNotification = async () => {}) {
  return load('src/server/services/push.ts', {
    'web-push': { sendNotification }, '../db': { prisma: db }, '../http': { HttpError }, '../lucid': lucid,
    '../env': { env: (key) => ({ VAPID_PUBLIC_KEY: 'dummy-public', VAPID_PRIVATE_KEY: 'dummy-private' })[key] },
  })
}

test('push bloqueia hosts internos, credenciais, portas e sufixos enganosos', () => {
  const { inscricaoValida } = pushService({})
  const subscription = (endpoint) => ({ endpoint, keys: { p256dh: 'dummy-p', auth: 'dummy-a' } })
  for (const endpoint of ['https://127.0.0.1/x', 'https://localhost/x', 'https://fcm.googleapis.com.evil.test/x', 'https://fcm.googleapis.com:8443/x', 'https://user:pass@fcm.googleapis.com/x', 'http://fcm.googleapis.com/x']) {
    assert.equal(inscricaoValida(subscription(endpoint)), false)
  }
  for (const endpoint of ['https://fcm.googleapis.com/x', 'https://updates.push.services.mozilla.com/x', 'https://web.push.apple.com/x', 'https://wns2.notify.windows.com/x']) {
    assert.equal(inscricaoValida(subscription(endpoint)), true)
  }
})

test('push ignora destino antigo inseguro e define timeout ao enviar', async () => {
  const sent = []
  const db = { pushInscricao: { findMany: async () => [
    { endpoint: 'https://127.0.0.1/x' },
    { endpoint: 'https://fcm.googleapis.com/x', p256dh: 'dummy-p', auth: 'dummy-a' },
  ] } }
  const service = pushService(db, async (...args) => sent.push(args))
  assert.deepEqual(await service.enviarPush('dummy-user', { titulo: 'Teste', mensagem: 'Teste', url: '/' }), { enviados: 1, removidos: 0 })
  assert.equal(sent.length, 1)
  assert.equal(sent[0][2].timeout, 5000)
})

test('push recusa o 11º aparelho mas permite atualizar um aparelho existente', async () => {
  let saved = 0
  let existing = null
  const tx = { $executeRaw: async () => {}, pushInscricao: {
    findUnique: async () => existing, count: async () => 10, upsert: async () => saved++,
  } }
  const { salvarInscricao } = pushService({ $transaction: (fn) => fn(tx) })
  const input = { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'dummy-p', auth: 'dummy-a' } }
  await assert.rejects(salvarInscricao('dummy-user', input), { status: 409 })
  assert.equal(saved, 0)
  existing = { userId: 'dummy-user' }
  await salvarInscricao('dummy-user', input)
  assert.equal(saved, 1)
})

function authService(db) {
  return load('src/server/services/auth.ts', {
    '../db': { prisma: db }, '../http': { HttpError }, '../lucid': lucid, '../auth/jwt': {},
    '../auth/password': { hashPassword: async (password) => `dummy-hash:${password}` },
    './mail': {}, '../emails/forgot_password': {},
  })
}

test('Google invalida a senha e sessões do cadastro não verificado e apaga resets anteriores', async () => {
  let password = 'attacker-password'
  let tokenVersion = 0
  let resets = 1
  const tx = {
    user: {
      findFirst: async () => ({ id: 'dummy-user', email: 'owner@example.test' }),
      updateMany: async ({ where, data }) => {
        assert.equal(where.isEmailVerified, 0)
        password = data.password
        tokenVersion += data.tokenVersion.increment
        return { count: 1 }
      },
      findUnique: async () => ({ id: 'dummy-user', tokenVersion }),
    },
    passwordResetToken: { deleteMany: async () => { resets = 0 } },
  }
  const service = authService({ $transaction: (fn) => fn(tx) })
  const user = await service.userForVerifiedGoogleEmail('owner@example.test')
  assert.notEqual(password, 'attacker-password')
  assert.equal(user.tokenVersion, 1)
  assert.equal(resets, 0)
})

test('reset concorrente só permite uma troca da senha', async () => {
  let available = true
  let changes = 0
  const db = {
    user: { findUnique: async () => ({ id: 'dummy-user' }), update: async () => changes++ },
    passwordResetToken: {
      findUnique: async () => ({ id: 'dummy-token', userId: 'dummy-user', expiresAt: new Date(Date.now() + 60_000) }),
      deleteMany: async ({ where }) => {
        if (where.userId) return { count: 0 }
        const count = available ? 1 : 0
        available = false
        return { count }
      },
    },
  }
  db.$transaction = (fn) => fn(db)
  const { resetPassword } = authService(db)
  const result = await Promise.allSettled([resetPassword('dummy', 'DummyPassword1!'), resetPassword('dummy', 'DummyPassword2!')])
  assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(changes, 1)
})

test('trocar plano preserva o uso mensal por padrão', async () => {
  const { definirPlano } = load('src/server/services/assinante.ts', { '../db': {}, '../lucid': lucid })
  const writes = []
  const db = { prestador: { update: async (args) => writes.push(args) } }
  await definirPlano(db, { tipo: 'prestador', id: 'dummy' }, 'pro')
  await definirPlano(db, { tipo: 'prestador', id: 'dummy' }, 'free')
  for (const { data } of writes) assert.equal(Object.hasOwn(data, 'monthlyAppointmentsUsed'), false)
})

test('requisições simultâneas não ultrapassam cinco tentativas do código', async () => {
  let row = {
    id: 'dummy-appointment', status: 'confirmado', startCode: '123456', startCodeAttempts: 0,
    startCodeExpiresAt: new Date(Date.now() + 60_000), startCodeUsedAt: null,
  }
  let waiting = Promise.resolve()
  const tx = {
    agendamento: {
      findFirst: async () => ({ ...row }),
      updateMany: async ({ data }) => { row = { ...row, ...data }; return { count: 1 } },
    },
  }
  const db = {
    $transaction: async (fn) => {
      let release
      const mine = new Promise((resolve) => { release = resolve })
      const previous = waiting
      let locked = false
      try {
        return await fn({ ...tx, $executeRaw: async () => {
          waiting = mine
          await previous
          locked = true
        } })
      } finally { if (locked) release() }
    },
  }
  const respond = (status) => (body) => ({ status, body })
  const { PATCH } = load('src/app/api/veterinarios/agendamentos/[id]/iniciar/route.ts', {
    'luxon': { DateTime: { fromJSDate: (date) => ({ toISO: () => date.toISOString() }) } },
    '@/server/db': { prisma: db }, '@/server/lucid': lucid,
    '@/server/auth/session': { requireUser: async () => ({ id: 'dummy-vet-user' }) },
    '@/server/services/veterinario-dashboard': {
      findVeterinarioByUser: async () => ({ id: 'dummy-vet' }), statusNormalizado: (status) => status,
    },
    '@/server/http': {
      route: (fn) => fn, ApiRequest: { from: async (req) => ({ only: () => req.body }) },
      badRequest: respond(400), notFound: respond(404), ok: respond(200), serverError: respond(500),
    },
  })
  const responses = await Promise.all(Array.from({ length: 20 }, () => PATCH({ body: { code: '000000' } }, { id: row.id })))
  assert.equal(responses.filter((res) => res.body.message === 'Código inválido').length, 5)
  assert.equal(row.startCodeAttempts, 5)
  assert.equal((await PATCH({ body: { code: '123456' } }, { id: row.id })).status, 400)
  assert.equal(row.status, 'confirmado')
})

function approvalService(db, notify) {
  const chain = new Proxy({}, { get: () => () => chain })
  const vine = {
    string: () => chain, enum: () => chain, object: () => chain,
    compile: () => ({ validate: async (body) => body }),
  }
  return load('src/server/services/aprovacoes.ts', {
    '@vinejs/vine': vine, '../db': { prisma: db }, '../http': { HttpError }, '../lucid': lucid,
    './agendamentos': { nomeCompleto: () => 'Dummy' }, './aviso-usuario': { avisarUsuario: notify },
  })
}

test('admin não aprova um CRMV trocado no mesmo segundo da listagem', async () => {
  let writes = 0
  const updatedAt = new Date('2026-10-23T12:00:00Z')
  const service = approvalService({ veterinario: {
    findUnique: async () => ({ id: 'dummy-vet', crmv: '222-SP', updatedAt, crmvStatus: 'pendente' }),
    updateMany: async () => { writes++; return { count: 1 } },
  } }, async () => assert.fail('Não pode notificar decisão rejeitada'))
  const revisao = service.revisaoCrmv({ crmv: '111-SP', updatedAt })
  await assert.rejects(service.decidirCrmv('dummy-vet', { decisao: 'aprovar', revisao }), { status: 409 })
  assert.equal(writes, 0)
})

test('admin não notifica aprovação perdida por alteração concorrente', async () => {
  const vet = { id: 'dummy-vet', crmv: '111-SP', updatedAt: new Date(), crmvStatus: 'pendente', user: { id: 'dummy-user' } }
  const service = approvalService({ veterinario: {
    findUnique: async () => vet, updateMany: async () => ({ count: 0 }),
  } }, async () => assert.fail('Não pode notificar decisão rejeitada'))
  await assert.rejects(service.decidirCrmv(vet.id, { decisao: 'aprovar', revisao: service.revisaoCrmv(vet) }), { status: 409 })
})

test('limites de experiências são checados antes de apagar os registros anteriores', async () => {
  let writes = 0
  const service = load('src/server/services/veterinarios.ts', {
    'luxon': {}, '@/generated/prisma/client': {}, '../db': { prisma: { $transaction: async () => writes++ } },
    '../auth/session': {}, '../auth/password': {}, '../lucid': lucid, './subscription': {},
    './assinante': {}, './aprovacoes': {}, '../http': { HttpError },
  })
  for (const input of ['invalid', Array(31).fill({ local: 'Dummy', cargo: 'Dummy' }), [{ local: 'Dummy', descricao: 'x'.repeat(5001) }]]) {
    await assert.rejects(service.replaceExperiencias('dummy-vet', input), { status: 422 })
  }
  assert.equal(writes, 0)
})

test('seed demo exige opt-in e recusa produção mesmo com opt-in', async () => {
  const { seedDemonstracao } = load('prisma/demo.ts', {
    '@adonisjs/hash/drivers/scrypt': { Scrypt: class {} },
    '@/generated/prisma/client': { Genero: {}, Porte: {}, TipoClinica: {}, UserType: {} }, 'luxon': {},
  })
  const originalMode = process.env.NODE_ENV
  const originalOptIn = process.env.SEED_DEMO
  try {
    process.env.NODE_ENV = 'production'
    process.env.SEED_DEMO = 'true'
    await assert.rejects(seedDemonstracao({}), /proibido em produção/)
    process.env.NODE_ENV = 'test'
    delete process.env.SEED_DEMO
    await assert.rejects(seedDemonstracao({}), /exigem SEED_DEMO=true/)
  } finally {
    if (originalMode === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalMode
    if (originalOptIn === undefined) delete process.env.SEED_DEMO
    else process.env.SEED_DEMO = originalOptIn
  }
})
