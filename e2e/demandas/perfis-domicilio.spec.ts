import { randomUUID } from 'node:crypto'
import { expect, test, criarTutor, SENHA, SEM_SESSAO } from '../fixtures'
import { consultar } from '../db'
import { novoPet } from '../agenda'

test.use({ storageState: SEM_SESSAO })

test('perfis próprios, planos separados, deslocamento e concorrência entre agendas', async ({ page, playwright }) => {
  test.setTimeout(180_000)
  const email = await criarTutor(page.request)
  expect((await page.request.post('/api/auth/login', { data: { email, password: SENHA } })).ok()).toBeTruthy()
  const [dono] = await consultar<{ id: string }>('select id from users where email = $1', [email])
  // Estas contas descartáveis não testam entrega de mensagens nem acionam provedores externos.
  await consultar('update users set notificar_email = 0, notificar_whatsapp = 0 where id = $1', [dono.id])
  const profissional = { cpf: '12345678901', sobrenome: 'E2E', celular: '85999999999' }
  const [tipo] = await consultar<{ slug: string }>("select slug from tipos_servico where ativo = 1 and modalidade = 'duracao' limit 1")
  for (const perfil of ['veterinario', 'prestador']) {
    const r = await page.request.post('/api/auth/perfis', { data: { tipo: perfil, tipo_servico: tipo.slug, ...profissional } })
    expect(r.status(), await r.text()).toBe(201)
  }
  const [vet] = await consultar<{ id: string; subscription_plan_code: string; crmv_status: string }>('select id, subscription_plan_code, crmv_status from veterinarios where user_id = $1', [dono.id])
  const [prest] = await consultar<{ id: string; subscription_plan_code: string }>('select id, subscription_plan_code from prestadores where user_id = $1', [dono.id])
  expect(vet.subscription_plan_code).toBe('none')
  expect(vet.crmv_status).toBe('pendente')
  expect(prest.subscription_plan_code).toBe('free')
  expect((await page.request.put('/api/auth/perfis', { data: { tipo: 'veterinario' } })).status()).toBe(200)
  expect((await page.request.get('/api/pets')).status()).toBe(403)
  const grade = Object.fromEntries(['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'].map(d => [d, Array.from({ length: 24 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)]))
  const config = await page.request.put('/api/veterinarios/agenda-config', { data: {
    atendeDomicilio: true, precoConsultaDomicilio: 150, horariosDomicilio: grade,
    duracaoPresencialMin: 30, duracaoOnlineMin: 30, duracaoDomicilioMin: 60, deslocamentoMin: 40,
  } })
  expect(config.status(), await config.text()).toBe(200)
  await consultar("update veterinarios set crmv_status = 'aprovado', onboarding_complete = 1, subscription_plan_code = 'vet_pro' where id = $1", [vet.id])
  await consultar('update prestadores set onboarding_complete = 1, horarios = $2::jsonb where id = $1', [prest.id, JSON.stringify(Object.fromEntries(Array.from({ length: 7 }, (_, i) => [String(i), ['08:00', '20:00']])) )])
  const servico = randomUUID()
  await consultar('insert into servicos_oferecidos (id, prestador_id, nome, preco, duracao_min, ativo) values ($1, $2, $3, 50, 60, 1)', [servico, prest.id, 'E2E agenda compartilhada'])

  const cliente = await playwright.request.newContext({ baseURL: 'http://localhost:3000', extraHTTPHeaders: { 'x-forwarded-for': '10.83.75.19' } })
  const emailCliente = await criarTutor(cliente)
  await consultar('update users set notificar_email = 0, notificar_whatsapp = 0 where email = $1', [emailCliente])
  await cliente.post('/api/auth/login', { data: { email: emailCliente, password: SENHA } })
  const pet = await novoPet(cliente)
  const endereco = await cliente.put('/api/tutor/profile', { data: { endereco: { cep: '60000000', rua: 'Rua Tutor E2E', numero: '25', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE' }, celular: '85999999999' } })
  expect(endereco.status(), await endereco.text()).toBe(200)
  const data = '2030-01-07'
  const reservarVet = (horario: string, dia = data) => cliente.post('/api/agendamentos', { data: { veterinario_id: vet.id, pet_id: pet.id, data_consulta: dia, horario_consulta: horario, tipo_consulta: 'domicilio' } })
  const primeira = await reservarVet('15:00')
  expect(primeira.status(), await primeira.text()).toBe(201)
  const id = (await primeira.json()).agendamento.id
  const [reserva] = await consultar<{ duracao_min: number; deslocamento_min: number; local_endereco: string }>('select duracao_min, deslocamento_min, local_endereco from agendamentos where id = $1', [id])
  expect(reserva.duracao_min).toBe(60)
  expect(reserva.deslocamento_min).toBe(40)
  expect(reserva.local_endereco).toContain('Rua Tutor E2E')
  const disp = await cliente.get(`/api/agendamentos/disponibilidade/${vet.id}?data=${data}&tipo_consulta=domicilio`)
  const ocupados = (await disp.json()).horarios_ocupados
  expect(ocupados).toContain('16:30')
  expect(ocupados).toContain('13:30')
  expect(ocupados).not.toContain('13:00')
  expect(ocupados).not.toContain('17:00')
  // A grade descreve o atendimento: deslocamento da primeira visita pode começar antes.
  expect(ocupados).not.toContain('08:00')
  expect((await reservarVet('16:30')).status()).toBe(409)
  const pedir = (horario: string, dia = data) => cliente.post(`/api/prestadores/${prest.id}/pedidos`, { data: { pet_id: pet.id, servico_id: servico, data: dia, horario, local: 'domicilio' } })
  expect((await pedir('16:30')).status()).toBe(409)
  expect((await pedir('17:00')).status()).toBe(201)
  const concorrentes = await Promise.all([reservarVet('15:00', '2030-01-08'), pedir('15:00', '2030-01-08')])
  expect(concorrentes.map(r => r.status()).sort()).toEqual([201, 409])
  const remarcar = await cliente.patch(`/api/agendamentos/${id}/reagendar`, { data: { data_consulta: data, horario_consulta: '16:00' } })
  expect(remarcar.status(), await remarcar.text()).toBe(409)

  await page.goto('/dashboard/veterinario/perfil')
  const tituloAgenda = page.getByRole('heading', { name: 'Duração e atendimento a domicílio' })
  await expect(tituloAgenda).toBeVisible()
  await expect(page.getByLabel('Deslocamento entre atendimentos (min)')).toHaveValue('40')
  await tituloAgenda.evaluate(el => window.scrollBy(0, el.getBoundingClientRect().top - 150))
  await page.screenshot({ path: 'test-results/agenda-config-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await tituloAgenda.evaluate(el => window.scrollBy(0, el.getBoundingClientRect().top - 110))
  await page.screenshot({ path: 'test-results/agenda-config-mobile.png' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/perfis?voltar=%2Fexames')
  await expect(page.getByRole('heading', { name: 'Meus perfis' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Usar como tutor' })).toBeVisible()
  await page.screenshot({ path: 'test-results/perfis-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: 'test-results/perfis-mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await page.getByRole('button', { name: 'Usar como tutor' }).click()
  await expect(page).toHaveURL('/exames')
  expect((await page.request.get('/api/veterinarios/agenda-config')).status()).toBe(403)
  const [planos] = await consultar<{ vet: string; prestador: string }>('select v.subscription_plan_code as vet, p.subscription_plan_code as prestador from veterinarios v join prestadores p on p.user_id = v.user_id where v.user_id = $1', [dono.id])
  expect(planos).toEqual({ vet: 'vet_pro', prestador: 'free' })
  await cliente.dispose()
})
