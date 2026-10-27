import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/server/db'
import { bloquearAgenda } from '@/server/services/agenda-lock'
import { consumirCotaVeterinario, liberarCotasVeterinario, usoMensalVeterinario } from '@/server/services/cotas-veterinario'
import { consumirCota, liberarCota } from '@/server/services/cotas-prestador'
import { criarProfissaoAdmin, atualizarProfissaoAdmin, inativarProfissaoAdmin, listarProfissoesAdmin } from '@/server/services/admin-profissoes'
import { criarPlanoSaudeAdmin, listarPlanosSaudeAdmin, inativarPlanoSaudeAdmin } from '@/server/services/admin-planos-saude'
import { syncPlanosVeterinario } from '@/server/services/veterinarios'
import { readFileSync } from 'node:fs'

// Nunca usa produção nem o banco de desenvolvimento normal.
const habilitado = Boolean(process.env.FREEMIUM_DATABASE_URL)
const ids = { vets: [] as string[], prestadores: [] as string[], users: [] as string[], tipos: [] as string[], planos: [] as string[] }
describe.skipIf(!habilitado)('freemium e profissões em PostgreSQL real', () => {
  beforeAll(async () => {
    const url = new URL(process.env.FREEMIUM_DATABASE_URL!)
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/lince_freemium_verified' || process.env.DATABASE_URL !== process.env.FREEMIUM_DATABASE_URL) throw new Error('Use exclusivamente o banco isolado lince_freemium_verified em localhost.')
    for (const code of ['free', 'vet_pro']) await prisma.subscriptionPlan.upsert({ where: { code }, create: { id: randomUUID(), code, name: code, priceCents: code === 'free' ? 0 : 5990, monthlyAppointmentLimit: code === 'free' ? 5 : null }, update: {} })
  })
  afterAll(async () => {
    await prisma.agendamento.deleteMany({ where: { OR: [{ veterinarioId: { in: ids.vets } }, { prestadorId: { in: ids.prestadores } }] } })
    await prisma.prestador.deleteMany({ where: { id: { in: ids.prestadores } } })
    await prisma.veterinario.deleteMany({ where: { id: { in: ids.vets } } })
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } })
    await prisma.tipoServico.deleteMany({ where: { id: { in: ids.tipos } } })
    await prisma.plano.deleteMany({ where: { id: { in: ids.planos } } })
    await prisma.$disconnect()
  })
  async function vet(code = 'free') {
    const id = randomUUID(); ids.vets.push(id)
    await prisma.veterinario.create({ data: { id, subscriptionPlanCode: code } }); return id
  }
  async function reservar(id: string, tipo: 'veterinario' | 'prestador' = 'veterinario') {
    return prisma.$transaction(async tx => {
      await bloquearAgenda(tx, tipo, id)
      const a = await tx.agendamento.create({ data: { id: randomUUID(), ...(tipo === 'veterinario' ? { veterinarioId: id } : { prestadorId: id }), status: 'confirmado' } })
      if (tipo === 'veterinario') await consumirCotaVeterinario(tx, id, a.id)
      else await consumirCota(tx, id, a.id)
      return a.id
    })
  }
  it('duas reservas concorrentes com quatro usos deixam só uma quinta; sexta reverte integralmente', async () => {
    const id = await vet()
    for (let i = 0; i < 4; i++) await reservar(id)
    const respostas = await Promise.allSettled([reservar(id), reservar(id)])
    expect(respostas.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(respostas.filter(r => r.status === 'rejected')).toHaveLength(1)
    expect(await prisma.agendamento.count({ where: { veterinarioId: id } })).toBe(5)
    expect(await usoMensalVeterinario(prisma, id)).toBe(5)
  })
  it('cancelar libera uma vez; cancelar reserva de outro mês não cria cota no mês atual', async () => {
    const id = await vet(); const atuais: string[] = []
    for (let i = 0; i < 5; i++) atuais.push(await reservar(id))
    const antiga = await prisma.agendamento.create({ data: { id: randomUUID(), veterinarioId: id, cotaConsumidaEm: new Date('2020-01-01'), status: 'cancelado' } })
    await prisma.$transaction(tx => liberarCotasVeterinario(tx, id, [antiga.id]))
    expect(await usoMensalVeterinario(prisma, id)).toBe(5)
    for (let i = 0; i < 2; i++) await prisma.$transaction(tx => liberarCotasVeterinario(tx, id, [atuais[0]]))
    expect(await usoMensalVeterinario(prisma, id)).toBe(4)
    await reservar(id)
    await expect(reservar(id)).rejects.toMatchObject({ status: 403 })
  })
  it('atendimento iniciado não devolve cota; cortesia Pro aceita além de cinco', async () => {
    const id = await vet(); const a = await reservar(id)
    await prisma.agendamento.update({ where: { id: a }, data: { startedAt: new Date() } })
    await prisma.$transaction(tx => liberarCotasVeterinario(tx, id, [a]))
    expect(await usoMensalVeterinario(prisma, id)).toBe(1)
    const cortesia = await vet('vet_pro')
    for (let i = 0; i < 6; i++) await reservar(cortesia)
    expect(await usoMensalVeterinario(prisma, cortesia)).toBe(6)
  })
  it('prestador tem cinco aceites, devolução idempotente e cota separada do veterinário', async () => {
    const userId = randomUUID(); ids.users.push(userId)
    await prisma.user.create({ data: { id: userId, email: `${userId}@teste.invalid`, password: 'nao-utilizavel', nome: 'Teste', userType: 'prestador' } })
    const tipoId = randomUUID(); ids.tipos.push(tipoId)
    await prisma.tipoServico.create({ data: { id: tipoId, slug: `t-${tipoId}`, nome: 'Tipo de teste' } })
    const id = randomUUID(); ids.prestadores.push(id)
    await prisma.prestador.create({ data: { id, userId, tipoServicoId: tipoId, subscriptionPlanCode: 'free' } })
    const vetId = await vet(); await prisma.veterinario.update({ where: { id: vetId }, data: { userId } })
    for (let i = 0; i < 5; i++) await reservar(vetId)
    for (let i = 0; i < 4; i++) await reservar(id, 'prestador')
    const resultados = await Promise.allSettled([reservar(id, 'prestador'), reservar(id, 'prestador')])
    expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    const a = await prisma.agendamento.findFirstOrThrow({ where: { prestadorId: id } })
    await prisma.$transaction(tx => liberarCota(tx, id, a.id))
    await prisma.$transaction(tx => liberarCota(tx, id, a.id))
    expect((await prisma.prestador.findUniqueOrThrow({ where: { id } })).monthlyAppointmentsUsed).toBe(4)
  })
  it('CRUD real preserva vínculos, rejeita duplicação e revisão antiga', async () => {
    const slug = `teste-${randomUUID()}`
    const payload = { nome: `Profissão ${slug}`, slug, descricao: 'Teste', modalidade: 'duracao', ordem: 10, ativo: true }
    const { id } = await criarProfissaoAdmin(payload); ids.tipos.push(id)
    const item = (await listarProfissoesAdmin()).find(t => t.id === id)!
    await atualizarProfissaoAdmin(id, { ...payload, nome: `${payload.nome} editada`, revisao: item.revisao })
    await expect(inativarProfissaoAdmin(id, { revisao: item.revisao })).rejects.toMatchObject({ status: 409 })
    const atual = (await listarProfissoesAdmin()).find(t => t.id === id)!
    await inativarProfissaoAdmin(id, { revisao: atual.revisao })
    expect((await prisma.tipoServico.findUniqueOrThrow({ where: { id } })).ativo).toBe(0)
    await expect(criarProfissaoAdmin({ ...payload, nome: atual.nome.toUpperCase(), slug: `x-${randomUUID()}` })).rejects.toMatchObject({ status: 409 })
  })
  it('plano de saúde inativo preserva vínculo antigo e rejeita novo vínculo', async () => {
    const { id } = await criarPlanoSaudeAdmin({ nome: `Saúde ${randomUUID()}`, ativo: true }); ids.planos.push(id)
    const dono = await vet(); const novo = await vet()
    await syncPlanosVeterinario(dono, [id])
    const plano = (await listarPlanosSaudeAdmin()).find(p => p.id === id)!
    expect(plano.vinculos).toBe(1)
    await inativarPlanoSaudeAdmin(id, { revisao: plano.revisao })
    await syncPlanosVeterinario(dono, [id])
    expect(await prisma.veterinarioPlano.count({ where: { veterinarioId: dono, planoId: id } })).toBe(1)
    await expect(syncPlanosVeterinario(novo, [id])).rejects.toMatchObject({ status: 422 })
    expect(await prisma.veterinarioPlano.count({ where: { veterinarioId: novo } })).toBe(0)
  })
  it('migração preserva cortesia e usa a criação original para reservas legadas', async () => {
    const cortesia = await vet('vet_pro'); const gratuito = await vet('none')
    const antiga = await prisma.agendamento.create({ data: { id: randomUUID(), veterinarioId: gratuito, status: 'cancelado', createdAt: new Date('2020-01-10T12:00:00Z') } })
    const sql = readFileSync('prisma/migrations/20261027165029_freemium_profissionais/migration.sql', 'utf8')
    await prisma.$transaction(async tx => {
      for (const statement of sql.split(';').filter(s => s.trim() && !s.includes('CREATE INDEX'))) await tx.$executeRawUnsafe(statement)
    })
    expect((await prisma.veterinario.findUniqueOrThrow({ where: { id: cortesia } })).subscriptionPlanCode).toBe('vet_pro')
    expect((await prisma.veterinario.findUniqueOrThrow({ where: { id: gratuito } })).subscriptionPlanCode).toBe('free')
    const atualizado = await prisma.agendamento.findUniqueOrThrow({ where: { id: antiga.id } })
    expect(atualizado.cotaConsumidaEm?.toISOString()).toBe('2020-01-10T12:00:00.000Z')
    expect(atualizado.cotaLiberadaEm).not.toBeNull()
  })
})
