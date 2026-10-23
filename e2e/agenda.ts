import { request as pwRequest, expect, type APIRequestContext } from '@playwright/test'
import { CONTAS, ipUnico, sessao, type Perfil } from './fixtures'
import { consultar } from './db'

const BASE_URL = 'http://localhost:3000'

/** Cliente da API logado como um perfil do seed (sessão do auth.setup), com IP próprio. */
export async function apiComo(perfil: Perfil) {
  return pwRequest.newContext({
    baseURL: BASE_URL,
    storageState: sessao(perfil),
    extraHTTPHeaders: { 'x-forwarded-for': ipUnico() },
  })
}

const sorteio = (n: number) => Math.floor(Math.random() * n)

/** Data futura (YYYY-MM-DD) longe o bastante para não cruzar com o seed nem com outras execuções. */
export function dataFutura(minDias = 40, faixa = 300) {
  const d = new Date()
  d.setDate(d.getDate() + minDias + sorteio(faixa))
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

export const horarioAleatorio = () => `${String(7 + sorteio(12)).padStart(2, '0')}:${['00', '15', '30', '45'][sorteio(4)]}`

export async function idVeterinario(perfil: Extract<Perfil, 'veterinario' | 'veterinario2'>) {
  const [linha] = await consultar<{ id: string }>(
    `select v.id from veterinarios v join users u on u.id = v.user_id where u.email = $1`,
    [CONTAS[perfil].email]
  )
  return linha.id
}

export async function idClinica() {
  const [linha] = await consultar<{ id: string }>(
    `select c.id from clinicas c join users u on u.id = c.user_id where u.email = $1`,
    [CONTAS.clinica.email]
  )
  return linha.id
}

export async function petsDoTutor(perfil: Extract<Perfil, 'tutor' | 'tutor2'>) {
  return consultar<{ id: string; nome: string }>(
    `select p.id, p.nome from pets p join tutores t on t.id = p.tutor_id join users u on u.id = t.user_id
     where u.email = $1 order by p.nome`,
    [CONTAS[perfil].email]
  )
}

export async function idPrestador() {
  const [linha] = await consultar<{ id: string; nome: string; tipo: string; atende_domicilio: number }>(
    `select p.id, u.nome, t.slug as tipo, p.atende_domicilio from prestadores p
     join users u on u.id = p.user_id join tipos_servico t on t.id = p.tipo_servico_id where u.email = $1`,
    [CONTAS.prestador.email]
  )
  return linha
}

/** Pet novo do tutor: sem histórico de consultas nem encaminhamentos de execuções anteriores. */
export async function novoPet(api: APIRequestContext, nome = `E2E ${Date.now()}`) {
  const res = await api.post('/api/pets', { data: { nome, especie: 'Cão', porte: 'medio' } })
  expect(res.status(), await res.text()).toBe(201)
  return (await res.json()).pet as { id: string; nome: string }
}

type NovaConsulta = { veterinarioId: string; petId: string; data?: string; horario?: string }

/** Tutor marca uma consulta online pela API e devolve o id. */
export async function marcarConsulta(api: APIRequestContext, c: NovaConsulta) {
  const data = c.data ?? dataFutura()
  const horario = c.horario ?? horarioAleatorio()
  const res = await api.post('/api/agendamentos', {
    data: { veterinario_id: c.veterinarioId, pet_id: c.petId, data_consulta: data, horario_consulta: horario, tipo_consulta: 'online' },
  })
  expect(res.status(), await res.text()).toBe(201)
  const { agendamento } = await res.json()
  return { id: agendamento.id as string, data, horario }
}

/** Vet inicia o atendimento com o código que o tutor recebeu (lido do banco local). */
export async function iniciarConsulta(apiVet: APIRequestContext, agendamentoId: string) {
  const [linha] = await consultar<{ start_code: string }>(`select start_code from agendamentos where id = $1`, [agendamentoId])
  const res = await apiVet.patch(`/api/veterinarios/agendamentos/${agendamentoId}/iniciar`, { data: { code: linha.start_code } })
  expect(res.status(), await res.text()).toBe(200)
}

export async function agendamento(id: string) {
  const [linha] = await consultar<{ status: string; data_consulta: string; horario_consulta: string; motivo_cancelamento: string | null; payment_status: string }>(
    `select status, data_consulta, horario_consulta, motivo_cancelamento, payment_status from agendamentos where id = $1`,
    [id]
  )
  return linha
}
