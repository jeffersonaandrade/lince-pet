import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { request as pwRequest, type APIRequestContext } from '@playwright/test'
import { expect, test, emailUnico, cnpjAleatorio, ipUnico, SENHA, sessao } from '../fixtures'
import { apiComo, dataFutura, idPrestador, idVeterinario, novoPet } from '../agenda'
import { consultar } from '../db'

async function clonar(tabela: 'users' | 'prestadores' | 'servicos_oferecidos' | 'clinicas', origem: string, dados: object) {
  await consultar(`insert into ${tabela} select (jsonb_populate_record(null::${tabela},to_jsonb(base)||$1::jsonb)).* from ${tabela} base where id=$2`, [JSON.stringify(dados), origem])
}
async function cliente(email: string) {
  const api = await pwRequest.newContext({ baseURL: 'http://localhost:3000', extraHTTPHeaders: { 'x-forwarded-for': ipUnico() } })
  const login = await api.post('/api/auth/login', { data: { email, password: SENHA } })
  expect(login.status(), await login.text()).toBe(200)
  return api
}
async function prestadorIsolado() {
  const origem = await idPrestador()
  const [p] = await consultar<{ user_id: string }>('select user_id from prestadores where id=$1', [origem.id])
  const [{ id: servicoOriginal }] = await consultar<{ id: string }>('select id from servicos_oferecidos where prestador_id=$1 and ativo=1 limit 1', [origem.id])
  const id = randomUUID(), userId = randomUUID(), servico = randomUUID(), email = emailUnico('cotas')
  await clonar('users', p.user_id, { id: userId, email, token_version: 0 })
  await clonar('prestadores', origem.id, { id, user_id: userId, subscription_plan_code: 'free', monthly_appointments_used: 0, monthly_appointments_reset_at: new Date().toISOString() })
  await clonar('servicos_oferecidos', servicoOriginal, { id: servico, prestador_id: id })
  return { id, userId, servico, api: await cliente(email), local: origem.atende_domicilio ? 'domicilio' : 'local_proprio' }
}
async function periodoLivre(tutor: APIRequestContext, p: { id: string; servico: string }, deslocamento: number) {
  for (let i = 0; i < 10; i++) {
    const data = dataFutura(450 + deslocamento + i, 0)
    const res = await tutor.get(`/api/prestadores/${p.id}/disponibilidade?servico_id=${p.servico}&data=${data}`)
    expect(res.ok(), await res.text()).toBeTruthy()
    const corpo = await res.json()
    const horarios = corpo.horarios ?? corpo.data?.horarios ?? corpo.data
    if (Array.isArray(horarios) && horarios.length) return { data, horario: typeof horarios[0] === 'string' ? horarios[0] : horarios[0].horario }
  }
  throw new Error('Fixture sem horário livre')
}
async function pedir(tutor: APIRequestContext, p: { id: string; servico: string; local: string }, petId: string, dia: number) {
  return tutor.post(`/api/prestadores/${p.id}/pedidos`, { data: { pet_id: petId, servico_id: p.servico, local: p.local, ...await periodoLivre(tutor, p, dia) } })
}
async function uso(prestadorId: string) {
  const [p] = await consultar<{ monthly_appointments_used: number }>('select monthly_appointments_used from prestadores where id=$1', [prestadorId])
  return p.monthly_appointments_used
}
async function limparPrestador(p: { id: string; userId: string; api: APIRequestContext }, petId: string) {
  await consultar('delete from agendamentos where prestador_id=$1', [p.id])
  await consultar('delete from pets where id=$1', [petId])
  await consultar('delete from users where id=$1', [p.userId])
  await p.api.dispose()
}

test('cotas: pendente não consome, limite de três pendentes e dois aceites disputam a última unidade', async () => {
  const tutor = await apiComo('tutor'), p = await prestadorIsolado()
  const pet = await novoPet(tutor, `E2E cotas ${randomUUID()}`)
  const pedidos: string[] = []
  try {
    for (let i = 0; i < 9; i++) await consultar("insert into agendamentos(id,prestador_id,status,cota_consumida_em) values($1,$2,'realizado',now())", [randomUUID(), p.id])
    await consultar('update prestadores set monthly_appointments_used=9 where id=$1', [p.id])
    for (const dia of [0, 15, 30]) {
      const res = await pedir(tutor, p, pet.id, dia)
      expect(res.status(), await res.text()).toBe(201)
      pedidos.push((await res.json()).data.id)
    }
    expect(await uso(p.id)).toBe(9)
    expect((await pedir(tutor, p, pet.id, 45)).status()).toBe(409)
    const aceites = await Promise.all(pedidos.slice(0, 2).map(id => p.api.patch(`/api/prestadores/pedidos/${id}/aceitar`, { data: {} })))
    expect(aceites.map(r => r.status()).sort()).toEqual([200, 403])
    expect(await uso(p.id)).toBe(10)
    const aceito = pedidos[aceites.findIndex(r => r.status() === 200)]
    expect((await p.api.patch(`/api/prestadores/pedidos/${aceito}/aceitar`, { data: {} })).status()).toBe(400)
    const cancelamentos = await Promise.all([0, 1].map(() => tutor.patch(`/api/agendamentos/${aceito}/cancelar`, { data: {} })))
    expect(cancelamentos.filter(r => r.status() === 200)).toHaveLength(1)
    expect(await uso(p.id)).toBe(9)
    const outro = pedidos[aceites.findIndex(r => r.status() === 403)]
    expect((await p.api.patch(`/api/prestadores/pedidos/${outro}/aceitar`, { data: {} })).status()).toBe(200)
    expect(await uso(p.id)).toBe(10)
    await consultar("update agendamentos set cota_consumida_em=date_trunc('month',now())-interval '1 day' where id=$1", [outro])
    await consultar('update prestadores set monthly_appointments_used=9 where id=$1', [p.id])
    expect((await tutor.patch(`/api/agendamentos/${outro}/cancelar`, { data: {} })).status()).toBe(200)
    expect(await uso(p.id)).toBe(9)
    const status = await p.api.get('/api/assinaturas/status')
    expect((await status.json()).usage.used).toBe(9)
  } finally { await limparPrestador(p, pet.id); await tutor.dispose() }
})

test('cotas: remarcação libera, novo aceite consome e cancelamento concorre com início sem devolver cota de serviço iniciado', async () => {
  const tutor = await apiComo('tutor'), p = await prestadorIsolado()
  const pet = await novoPet(tutor, `E2E remarcação ${randomUUID()}`)
  try {
    const res = await pedir(tutor, p, pet.id, 0)
    expect(res.status(), await res.text()).toBe(201)
    const id = (await res.json()).data.id
    expect((await p.api.patch(`/api/prestadores/pedidos/${id}/aceitar`, { data: {} })).status()).toBe(200)
    expect(await uso(p.id)).toBe(1)
    const remarcado = await tutor.patch(`/api/agendamentos/${id}/reagendar`, { data: await periodoLivre(tutor, p, 15) })
    expect(remarcado.status(), await remarcado.text()).toBe(200)
    expect(await uso(p.id)).toBe(0)
    expect((await p.api.patch(`/api/prestadores/pedidos/${id}/aceitar`, { data: {} })).status()).toBe(200)
    expect(await uso(p.id)).toBe(1)
    const [{ start_code: code }] = await consultar<{ start_code: string }>('select start_code from agendamentos where id=$1', [id])
    const respostas = await Promise.all([
      p.api.patch(`/api/prestadores/pedidos/${id}/iniciar`, { data: { code } }),
      tutor.patch(`/api/agendamentos/${id}/cancelar`, { data: {} }),
    ])
    expect(respostas.filter(r => r.status() === 200)).toHaveLength(1)
    const [{ status }] = await consultar<{ status: string }>('select status from agendamentos where id=$1', [id])
    expect(await uso(p.id)).toBe(status === 'cancelado' ? 0 : 1)
    if (status === 'em andamento') {
      expect((await p.api.patch(`/api/prestadores/pedidos/${id}/concluir`, { data: {} })).status()).toBe(200)
      expect(await uso(p.id)).toBe(1)
    }
  } finally { await limparPrestador(p, pet.id); await tutor.dispose() }
})

test('consulta exige início; arquivar preserva registro e permissões e bloqueia novos pedidos', async ({ browser }) => {
  const tutor = await apiComo('tutor'), vet = await apiComo('veterinario'), outroTutor = await apiComo('tutor2')
  const pet = await novoPet(tutor, `E2E histórico ${randomUUID()}`)
  const veterinarioId = await idVeterinario('veterinario')
  const [{ tutor_id: tutorId }] = await consultar<{ tutor_id: string }>('select tutor_id from pets where id=$1', [pet.id])
  const id = randomUUID(), registro = randomUUID(), code = '728193'
  const contexto = await browser.newContext({ storageState: sessao('tutor') })
  try {
    await consultar("insert into agendamentos(id,tutor_id,pet_id,veterinario_id,status,tipo_consulta,preco_consulta,data_consulta,horario_consulta,start_code,start_code_expires_at,created_at,updated_at) values($1,$2,$3,$4,'pendente','online',0,$5,'09:00',$6,now()+interval '10 days',now(),now())", [id, tutorId, pet.id, veterinarioId, dataFutura(), code])
    expect((await vet.patch(`/api/veterinarios/agendamentos/${id}/concluir`, { data: {} })).status()).toBe(400)
    expect((await vet.patch(`/api/veterinarios/agendamentos/${id}/iniciar`, { data: { code } })).status()).toBe(200)
    const concluidos = await Promise.all([0, 1].map(() => vet.patch(`/api/veterinarios/agendamentos/${id}/concluir`, { data: {} })))
    expect(concluidos.some(r => r.status() === 200)).toBeTruthy()
    const [agendamento] = await consultar('select status,started_at,ended_at,start_code_used_at from agendamentos where id=$1', [id])
    expect(agendamento).toMatchObject({ status: 'realizado' })
    expect(agendamento.started_at).not.toBeNull(); expect(agendamento.ended_at).not.toBeNull(); expect(agendamento.start_code_used_at).not.toBeNull()
    await consultar('insert into registros_clinicos(id,agendamento_id,pet_id,veterinario_id,diagnostico) values($1,$2,$3,$4,$5)', [registro, id, pet.id, veterinarioId, 'Histórico E2E preservado'])
    const page = await contexto.newPage()
    await page.goto('/dashboard/tutor')
    await page.getByRole('button', { name: `Editar ${pet.nome}`, exact: true }).click()
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Arquivar pet', exact: true }).click()
    await expect(page.getByRole('button', { name: `Editar ${pet.nome}`, exact: true })).toHaveCount(0)
    await page.getByText('Pets arquivados', { exact: false }).click()
    await page.getByRole('button', { name: `Prontuário de ${pet.nome}`, exact: true }).click()
    await page.getByRole('button', { name: /Com registro/ }).click()
    await expect(page.getByText('Histórico E2E preservado')).toBeVisible()
    expect((await consultar('select id from registros_clinicos where id=$1', [registro]))).toHaveLength(1)
    expect((await consultar('select pet_id from agendamentos where id=$1', [id]))[0].pet_id).toBe(pet.id)
    expect((await vet.get(`/api/pets/${pet.id}/prontuario`)).status()).toBe(200)
    expect((await outroTutor.get(`/api/pets/${pet.id}/prontuario`)).status()).toBe(404)
    const ativos = (await (await tutor.get('/api/pets')).json()).pets
    expect(ativos.some((p: { id: string }) => p.id === pet.id)).toBe(false)
    const novo = await tutor.post('/api/agendamentos', { data: { pet_id: pet.id, veterinario_id: veterinarioId, data_consulta: dataFutura(), horario_consulta: '09:00', tipo_consulta: 'online' } })
    expect(novo.ok()).toBe(false)
  } finally {
    await consultar('delete from agendamentos where id=$1', [id]); await consultar('delete from pets where id=$1', [pet.id])
    await Promise.all([contexto.close(), tutor.dispose(), vet.dispose(), outroTutor.dispose()])
  }
})

async function criarClinica(request: APIRequestContext) {
  const email = emailUnico('cnpj-original'), cnpj = cnpjAleatorio()
  const res = await request.post('/api/clinicas/register', { data: { nomeFantasia: 'Clínica fictícia E2E', razaoSocial: 'Clínica fictícia E2E', cnpj, email, senha: SENHA } })
  expect(res.status(), await res.text()).toBe(201)
  const [{ id, user_id: userId }] = await consultar<{ id: string; user_id: string }>('select c.id,c.user_id from clinicas c join users u on u.id=c.user_id where u.email=$1', [email])
  return { id, userId, email, cnpj }
}
async function confirmarSolicitacao(email: string, api: APIRequestContext) {
  const headers = { 'x-forwarded-for': ipUnico() }
  const [pedido] = await consultar<{ id: string }>('select id from recuperacoes_cnpj where email_novo=$1 order by created_at desc limit 1', [email])
  expect(pedido).toBeTruthy()
  // E-mail usa MAIL_DRIVER=log: entrega é substituída por token conhecido só no fixture local.
  const token = randomBytes(32).toString('hex')
  await consultar('update recuperacoes_cnpj set token_hash=$2 where id=$1', [pedido.id, createHash('sha256').update(token).digest('hex')])
  expect((await api.post('/api/recuperacao-cnpj/verificar', { data: { token: '0'.repeat(64) }, headers })).status()).toBe(400)
  const confirmado = await api.post('/api/recuperacao-cnpj/verificar', { data: { token }, headers })
  expect(confirmado.status(), await confirmado.text()).toBe(200)
  expect((await api.post('/api/recuperacao-cnpj/verificar', { data: { token }, headers })).status()).toBe(400)
  return pedido.id
}

test('CNPJ: máscara não duplica; solicitação não transfere; admin recupera original e revoga senha/sessão antiga', async ({ browser, request }) => {
  const clinica = await criarClinica(request), novoEmail = emailUnico('representante')
  const original = await cliente(clinica.email), admin = await apiComo('admin'), tutor = await apiComo('tutor')
  const solicitante = await browser.newContext(), administrador = await browser.newContext({ storageState: sessao('admin') })
  try {
    const mascarado = `${clinica.cnpj.slice(0,2)}.${clinica.cnpj.slice(2,5)}.${clinica.cnpj.slice(5,8)}/${clinica.cnpj.slice(8,12)}-${clinica.cnpj.slice(12)}`
    const duplicado = await request.post('/api/clinicas/register', { data: { nomeFantasia: 'Duplicada fictícia', razaoSocial: 'Duplicada fictícia', cnpj: mascarado, email: emailUnico(), senha: SENHA } })
    expect(duplicado.status()).toBe(422)
    const page = await solicitante.newPage()
    await page.goto('/recuperar-clinica')
    await page.getByLabel('CNPJ', { exact: true }).fill(mascarado)
    await page.getByLabel('Nome do representante').fill('Representante fictício E2E')
    await page.getByLabel('Novo e-mail de acesso').fill(novoEmail)
    await page.getByLabel('Descreva sua relação com a empresa').fill('Sou o representante fictício desta clínica exclusivamente para teste local.')
    await page.getByRole('button', { name: 'Solicitar análise' }).click()
    await expect(page.getByRole('status')).toContainText('enviaremos')
    const [{ id }] = await consultar<{ id: string }>('select id from recuperacoes_cnpj where email_novo=$1', [novoEmail])
    const decisao = { decisao: 'aprovar', justificativa: 'Representação conferida no cenário fictício de teste local.', evidencia: 'Protocolo privado fictício E2E-123: poderes de representação conferidos.', representacaoConferida: true }
    expect((await admin.patch(`/api/admin/recuperacoes-cnpj/${id}`, { data: decisao })).status()).toBe(409)
    expect((await original.get('/api/auth/me')).status()).toBe(200)
    expect((await tutor.get('/api/admin/recuperacoes-cnpj')).status()).toBe(403)
    expect((await tutor.patch(`/api/admin/recuperacoes-cnpj/${id}`, { data: decisao })).status()).toBe(403)
    await confirmarSolicitacao(novoEmail, request)
    expect((await admin.patch(`/api/admin/recuperacoes-cnpj/${id}`, { data: { ...decisao, evidencia: '' } })).status()).toBe(400)
    await consultar("update clinicas set subscription_plan_code='clinic' where id=$1", [clinica.id])
    // Referências fictícias: nenhuma chamada ao Asaas ocorre neste fluxo manual.
    await consultar("insert into subscriptions(id,clinica_id,plan_id,asaas_subscription_id,asaas_customer_id,status) select $1,$2,id,'sub_e2e_ficticia','cus_e2e_ficticio','active' from subscription_plans where code='clinic'", [randomUUID(), clinica.id])
    const semConferencia = await admin.patch(`/api/admin/recuperacoes-cnpj/${id}`, { data: decisao })
    expect(semConferencia.status()).toBe(409)
    expect((await semConferencia.json()).message).toContain('faturamento')
    const painel = await administrador.newPage()
    await painel.goto('/admin/recuperacoes')
    const card = painel.getByRole('article', { name: `Recuperação ${clinica.cnpj}` })
    await card.getByLabel('Referência da comprovação').fill(decisao.evidencia)
    await card.getByLabel('Justificativa da decisão').fill(decisao.justificativa)
    await card.getByLabel('Conferi a representação e a documentação da empresa.').check()
    await card.getByLabel('Conferi e atualizei o contato de faturamento no Asaas, ou confirmei que não há cadastro de faturamento.').check()
    painel.once('dialog', dialog => dialog.accept())
    await card.getByRole('button', { name: 'Aprovar e recuperar acesso' }).click()
    await expect(card.getByRole('status')).toContainText('Acesso recuperado')
    expect((await original.get('/api/auth/me')).status()).toBe(401)
    expect((await admin.patch(`/api/admin/recuperacoes-cnpj/${id}`, { data: decisao })).status()).toBe(409)
    const [audit] = await consultar('select status,evidencia,justificativa,administrador_id,faturamento_conferido from recuperacoes_cnpj where id=$1', [id])
    expect(audit).toMatchObject({ status: 'aprovado', evidencia: decisao.evidencia, justificativa: decisao.justificativa })
    expect(audit.administrador_id).toBeTruthy()
    expect(audit.faturamento_conferido).toBe(true)
    expect((await consultar('select redefinicao_senha_obrigatoria from users where id=$1', [clinica.userId]))[0].redefinicao_senha_obrigatoria).toBe(true)
    const [atual] = await consultar('select u.email,u.token_version,c.id,c.subscription_plan_code from users u join clinicas c on c.user_id=u.id where u.id=$1', [clinica.userId])
    expect(atual).toMatchObject({ email: novoEmail, token_version: 1, id: clinica.id, subscription_plan_code: 'clinic' })
    expect((await request.post('/api/auth/login', { data: { email: novoEmail, password: SENHA } })).status()).toBe(400)
    const [{ token }] = await consultar<{ token: string }>('select token from password_reset_tokens where user_id=$1', [clinica.userId])
    const senhaNova = 'NovaSenhaE2E!123'
    expect((await request.post('/api/auth/reset-password', { data: { token, password: senhaNova, password_confirmation: senhaNova } })).status()).toBe(200)
    expect((await consultar('select redefinicao_senha_obrigatoria from users where id=$1', [clinica.userId]))[0].redefinicao_senha_obrigatoria).toBe(false)
    expect((await request.post('/api/auth/login', { data: { email: novoEmail, password: senhaNova } })).status()).toBe(200)
  } finally {
    await consultar('delete from recuperacoes_cnpj where clinica_id=$1', [clinica.id]); await consultar('delete from users where id=$1', [clinica.userId])
    await Promise.all([original.dispose(), admin.dispose(), tutor.dispose(), solicitante.close(), administrador.close()])
  }
})

test('CNPJ: token expirado, reprovação sem alterar acesso e duas aprovações não transferem a mesma conta duas vezes', async ({ request }) => {
  const clinica = await criarClinica(request), admin = await apiComo('admin')
  const original = await cliente(clinica.email)
  const pedidos: { id: string; email: string }[] = []
  const decisao = { decisao: 'aprovar', justificativa: 'Comprovação fictícia conferida exclusivamente para teste local.', evidencia: 'Protocolo E2E privado de representação e identidade do responsável.', representacaoConferida: true }
  try {
    for (let i = 0; i < 3; i++) {
      const email = emailUnico(`recuperacao-${i}`)
      expect((await request.post('/api/recuperacao-cnpj', { data: { cnpj: clinica.cnpj, email, representante: 'Representante E2E', relato: 'Solicitação fictícia de representação para verificar concorrência local.' } })).status()).toBe(200)
      const [{ id }] = await consultar<{ id: string }>('select id from recuperacoes_cnpj where email_novo=$1', [email])
      pedidos.push({ id, email })
    }
    const token = randomBytes(32).toString('hex')
    await consultar("update recuperacoes_cnpj set token_hash=$2,token_expira_em=now()-interval '1 minute' where id=$1", [pedidos[0].id, createHash('sha256').update(token).digest('hex')])
    expect((await request.post('/api/recuperacao-cnpj/verificar', { data: { token } })).status()).toBe(400)
    await consultar("update recuperacoes_cnpj set token_expira_em=now()+interval '1 day' where id=$1", [pedidos[0].id])
    for (const pedido of pedidos) await confirmarSolicitacao(pedido.email, request)
    const reprovado = await admin.patch(`/api/admin/recuperacoes-cnpj/${pedidos[0].id}`, { data: { decisao: 'reprovar', justificativa: 'A comprovação fictícia não demonstra poderes de representação.' } })
    expect(reprovado.status(), await reprovado.text()).toBe(200)
    expect((await original.get('/api/auth/me')).status()).toBe(200)
    const decisoes = await Promise.all(pedidos.slice(1).map(pedido => admin.patch(`/api/admin/recuperacoes-cnpj/${pedido.id}`, { data: decisao })))
    expect(decisoes.map(r => r.status()).sort()).toEqual([200, 409])
    const [{ total }] = await consultar<{ total: string }>("select count(*) total from recuperacoes_cnpj where clinica_id=$1 and status='aprovado'", [clinica.id])
    expect(total).toBe('1')
    const [{ email, token_version }] = await consultar<{ email: string; token_version: number }>('select email,token_version from users where id=$1', [clinica.userId])
    expect(email).toBe(pedidos[1 + decisoes.findIndex(r => r.status() === 200)].email)
    expect(token_version).toBe(1)
  } finally {
    await consultar('delete from recuperacoes_cnpj where clinica_id=$1', [clinica.id]); await consultar('delete from users where id=$1', [clinica.userId])
    await Promise.all([admin.dispose(), original.dispose()])
  }
})

test('exames: duas reservas concorrentes não ultrapassam a última unidade do plano e cancelar libera a vaga mensal', async ({ request }) => {
  const clinica = await criarClinica(request), tutor = await apiComo('tutor'), outroTutor = await apiComo('tutor2')
  const pet = await novoPet(tutor, `E2E limite exame ${randomUUID()}`), outroPet = await novoPet(outroTutor, `E2E limite exame 2 ${randomUUID()}`), exameId = randomUUID()
  try {
    const grade = Object.fromEntries(['domingo','segunda','terca','quarta','quinta','sexta','sabado'].map(dia => [dia, '08:00-18:00']))
    await consultar("update clinicas set subscription_plan_code='starter',exames_ativo=1,rt_status='aprovado',horarios_funcionamento=$2::jsonb,onboarding_complete=1 where id=$1", [clinica.id, JSON.stringify(grade)])
    await consultar('insert into exames_oferecidos(id,clinica_id,nome,preco,duracao_min,capacidade,ativo) values($1,$2,$3,40,30,2,1)', [exameId, clinica.id, 'Exame fictício de concorrência'])
    for (let i = 0; i < 99; i++) await consultar("insert into agendamentos(id,clinica_id,tipo_consulta,status,created_at) values($1,$2,'exame','realizado',now())", [randomUUID(), clinica.id])
    const corpo = { pet_id: pet.id, exame_ids: [exameId], data: dataFutura(480, 0), horario: '09:00' }
    const respostas = await Promise.all([
      tutor.post(`/api/exames/clinicas/${clinica.id}/agendar`, { data: corpo }),
      outroTutor.post(`/api/exames/clinicas/${clinica.id}/agendar`, { data: { ...corpo, pet_id: outroPet.id } }),
    ])
    expect(respostas.map(r => r.status()).sort()).toEqual([201, 403])
    const criado = (await respostas.find(r => r.status() === 201)!.json()).agendamento.id
    const [{ total }] = await consultar<{ total: string }>("select count(*) total from agendamentos where clinica_id=$1 and tipo_consulta='exame' and status<>'cancelado'", [clinica.id])
    expect(total).toBe('100')
    const dono = respostas[0].status() === 201 ? tutor : outroTutor
    expect((await dono.patch(`/api/agendamentos/${criado}/cancelar`, { data: {} })).status()).toBe(200)
    const novo = await tutor.post(`/api/exames/clinicas/${clinica.id}/agendar`, { data: { ...corpo, horario: '10:00' } })
    expect(novo.status(), await novo.text()).toBe(201)
  } finally {
    await consultar('delete from agendamentos where clinica_id=$1', [clinica.id]); await consultar('delete from pets where id=any($1::text[])', [[pet.id, outroPet.id]]); await consultar('delete from users where id=$1', [clinica.userId])
    await Promise.all([tutor.dispose(), outroTutor.dispose()])
  }
})

test('consulta: início com código concorre com cancelamento sem produzir consulta realizada/cancelada indevidamente', async () => {
  const tutor = await apiComo('tutor'), vet = await apiComo('veterinario')
  const pet = await novoPet(tutor, `E2E corrida consulta ${randomUUID()}`), id = randomUUID()
  const [{ tutor_id: tutorId }] = await consultar<{ tutor_id: string }>('select tutor_id from pets where id=$1', [pet.id])
  const veterinarioId = await idVeterinario('veterinario'), code = '563728'
  try {
    await consultar("insert into agendamentos(id,tutor_id,pet_id,veterinario_id,status,tipo_consulta,data_consulta,horario_consulta,start_code,start_code_expires_at,created_at) values($1,$2,$3,$4,'pendente','online',$5,'11:00',$6,now()+interval '10 days',now())", [id, tutorId, pet.id, veterinarioId, dataFutura(), code])
    const respostas = await Promise.all([
      vet.patch(`/api/veterinarios/agendamentos/${id}/iniciar`, { data: { code } }),
      tutor.patch(`/api/agendamentos/${id}/cancelar`, { data: {} }),
    ])
    expect(respostas.filter(r => r.status() === 200)).toHaveLength(1)
    const [{ status, started_at }] = await consultar<{ status: string; started_at: Date | null }>('select status,started_at from agendamentos where id=$1', [id])
    const concluido = await vet.patch(`/api/veterinarios/agendamentos/${id}/concluir`, { data: {} })
    if (status === 'cancelado') { expect(started_at).toBeNull(); expect(concluido.status()).toBe(400) }
    else { expect(status).toBe('em andamento'); expect(started_at).not.toBeNull(); expect(concluido.status()).toBe(200) }
  } finally {
    await consultar('delete from agendamentos where id=$1', [id]); await consultar('delete from pets where id=$1', [pet.id])
    await Promise.all([tutor.dispose(), vet.dispose()])
  }
})

test('CNPJ: banco rejeita máscara equivalente mesmo em inserção externa que ignora a API', async () => {
  const ids = [randomUUID(), randomUUID()], cnpj = cnpjAleatorio()
  const [{ id: origem }] = await consultar<{ id: string }>('select id from clinicas limit 1')
  const mascarado = `${cnpj.slice(0,2)}.${cnpj.slice(2,5)}.${cnpj.slice(5,8)}/${cnpj.slice(8,12)}-${cnpj.slice(12)}`
  try {
    await clonar('clinicas', origem, { id: ids[0], user_id: null, cnpj })
    await expect(clonar('clinicas', origem, { id: ids[1], user_id: null, cnpj: mascarado })).rejects.toMatchObject({ code: '23505' })
  } finally { await consultar('delete from clinicas where id=any($1::text[])', [ids]) }
})
