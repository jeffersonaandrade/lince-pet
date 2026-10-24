import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { cnpjAleatorio, emailUnico, expect, SENHA, sessao, test } from '../fixtures'
import { consultar } from '../db'
import { idVeterinario } from '../agenda'
import { agendarPelaTela, cadastrarPetPelaTela, cartaoDoPet, iniciarAtendimentoPelaTela, somarDias } from '../telas'

async function cadastrarLaboratorio(page: Page, nome: string) {
  const email = emailUnico('laboratorio')
  await page.route('**/api/external/cep/**', route => route.fulfill({ json: {
    cep: '13330000', rua: 'Rua dos Exames', bairro: 'Centro', cidade: 'Indaiatuba', estado: 'SP',
  } }))
  await page.goto('/signup')
  await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Clínica e laboratório', exact: true }) }).click()
  await page.getByLabel('Nome da Clinica').fill(nome)
  await page.getByLabel('Razão Social').fill(`${nome} LTDA`)
  await page.getByLabel('CNPJ').fill(cnpjAleatorio())
  await page.getByLabel('Telefone').fill('1938751234')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByLabel('CEP').fill('13330000')
  await expect(page.getByLabel('Cidade')).toHaveValue('Indaiatuba')
  await page.getByLabel('Número').fill('100')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(SENHA)
  await page.getByRole('button', { name: 'Finalizar' }).click()
  await expect(page).toHaveURL('/onboarding/clinica')
  await page.getByRole('button', { name: 'Começar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Especialidades', exact: true })).toBeVisible()
  await page.getByText('Patologia clínica veterinária', { exact: true }).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Comodidades', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Horário de Funcionamento', exact: true })).toBeVisible()
  // Todos os dias têm uma hora de expediente para os testes não dependerem do dia da semana.
  for (const dia of await page.locator('[class*="daySchedule"]').all()) {
    await dia.getByRole('button', { name: '08:00', exact: true }).click()
    await dia.getByRole('button', { name: '08:30', exact: true }).click()
  }
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Perfil da Clínica', exact: true })).toBeVisible()
  await page.getByPlaceholder('Descreva a história, missão e valores da clínica...').fill('Laboratório de exames veterinários sem equipe de consultas vinculada.')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Planos de Saúde', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Concluir', exact: true }).click()
  await expect(page).toHaveURL('/dashboard/clinica')
  const [lab] = await consultar<{ id: string; onboarding_complete: number; quantidade_vets: string }>(
    'select c.id,c.onboarding_complete,c.quantidade_vets from clinicas c join users u on u.id=c.user_id where u.email=$1', [email],
  )
  expect(lab.onboarding_complete).toBe(1)
  expect(lab.quantidade_vets).toBe('0')
  return lab.id
}

async function oferecerExame(page: Page, nome: string, preco: string, capacidade: string) {
  const secao = page.getByRole('region', { name: 'Exames oferecidos' })
  await secao.getByLabel('Nome do exame').fill(nome)
  await secao.getByLabel('Preço (R$)').fill(preco)
  await secao.getByLabel('Duração (minutos)').fill('30')
  await secao.getByLabel('Vagas por horário').fill(capacidade)
  await secao.getByLabel('Preparo').fill('Seguir as orientações do laboratório.')
  await secao.getByRole('button', { name: 'Adicionar exame' }).click()
  await expect(secao.getByRole('listitem', { name: nome })).toBeVisible()
}

async function confirmarExame(page: Page, nome: string, pet: string, data: string, hora = '08:00') {
  await page.getByRole('checkbox', { name: new RegExp(nome) }).check()
  await page.getByLabel('Data do exame').fill(data)
  await page.getByRole('radiogroup', { name: 'Horários disponíveis' }).getByRole('radio', { name: hora, exact: true }).click()
  await page.getByRole('region', { name: 'Confirmar agendamento' }).getByRole('combobox').selectOption({ label: pet })
  await page.getByRole('button', { name: 'Confirmar agendamento', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Exame agendado' })).toBeVisible()
}

test('inserção de veterinário sem plano explícito recebe none do banco', async () => {
  const id = randomUUID()
  try {
    const [vet] = await consultar<{ subscription_plan_code: string }>(
      'insert into veterinarios(id) values($1) returning subscription_plan_code', [id],
    )
    expect(vet.subscription_plan_code).toBe('none')
  } finally {
    await consultar('delete from veterinarios where id=$1', [id])
  }
})

test('laboratório novo sem veterinários: cadastro, exames para dois tutores e encaminhamento preservado', async ({ browser }, testInfo) => {
  test.setTimeout(8 * 60_000)
  const marca = randomUUID().slice(0, 8)
  const nome = `Laboratório E2E ${marca}`
  const hemograma = `Hemograma ${marca}`, urina = `Urinálise ${marca}`, imagem = `Ultrassom ${marca}`
  const labCtx = await browser.newContext()
  const lab = await labCtx.newPage()
  const tutorCtx = await browser.newContext({ storageState: sessao('tutor') })
  const tutor = await tutorCtx.newPage()
  const segundoCtx = await browser.newContext({ storageState: sessao('tutor2') })
  const segundo = await segundoCtx.newPage()
  const vetCtx = await browser.newContext({ storageState: sessao('veterinario') })
  const vet = await vetCtx.newPage()
  let labId = ''
  try {
    await test.step('cadastro e onboarding inteiros pela tela, sem cadastrar nem vincular veterinário', async () => {
      labId = await cadastrarLaboratorio(lab, nome)
      expect((await consultar<{ total: string }>('select count(*) as total from veterinario_clinicas where clinica_id=$1', [labId]))[0].total).toBe('0')
    })
    await test.step('sem plano não liga exames; prepara somente plano de teste no banco local', async () => {
      await lab.goto('/dashboard/clinica/exames')
      const modulo = lab.getByLabel('Receber agendamentos de exames')
      await expect(lab.getByRole('region', { name: 'Assine um plano', exact: true })).toBeVisible()
      await expect(modulo).toHaveCount(0)
      expect((await lab.request.patch('/api/clinicas/exames', { data: { ativo: true } })).status()).toBe(403)
      // Pré-condição explícita: o fluxo financeiro é homologado em separado. Não cria cobrança externa.
      await consultar("update clinicas set subscription_plan_code='clinic' where id=$1", [labId])
      await lab.reload()
      await modulo.click()
      await expect(modulo).toBeChecked()
    })
    await test.step('oferece três exames, preços, preparos e capacidades independentes; envia RT', async () => {
      await oferecerExame(lab, hemograma, '60', '1')
      await oferecerExame(lab, urina, '40', '2')
      await oferecerExame(lab, imagem, '150', '1')
      const rt = lab.getByRole('region', { name: 'Responsável técnico' })
      await rt.getByLabel('Nome do responsável técnico').fill(`RT Laboratório ${marca}`)
      await rt.getByLabel('CRMV do responsável técnico').fill('12345-SP')
      await rt.getByRole('button', { name: 'Enviar para análise' }).click()
      await expect(rt.getByText('Enviado para análise da equipe Lince Pet.')).toBeVisible()
      await tutor.goto(`/explorar?tab=exames&search=${marca}`)
      await expect(tutor.getByRole('article', { name: nome })).toHaveCount(0)
    })
    await test.step('admin aprova o RT; catálogo público aparece sem vínculo com veterinários', async () => {
      const adminCtx = await browser.newContext({ storageState: sessao('admin') })
      try {
        const admin = await adminCtx.newPage(); await admin.goto('/admin/aprovacoes')
        await admin.getByRole('region', { name: 'RT de clínicas' }).getByRole('listitem', { name: nome }).getByRole('button', { name: 'Aprovar' }).click()
        await expect(admin.getByRole('status')).toHaveText('Aprovado. O usuário foi avisado.')
      } finally { await adminCtx.close() }
      await tutor.reload()
      const card = tutor.getByRole('article', { name: nome })
      await expect(card).toContainText(hemograma)
      await expect(card).toContainText(urina)
      await expect(card).toContainText(imagem)
    })
    const pet = await cadastrarPetPelaTela(tutor, `E2E Lab ${Date.now()}`)
    const pet2 = await cadastrarPetPelaTela(segundo, `E2E Lab2 ${Date.now()}`)
    const dia = somarDias(new Date().toISOString().slice(0, 10), 21)
    await test.step('primeiro tutor agenda dois exames avulsos sem encaminhamento', async () => {
      await tutor.goto(`/exames/${labId}`)
      await tutor.getByRole('checkbox', { name: new RegExp(hemograma) }).check()
      await confirmarExame(tutor, urina, pet, dia)
      await expect(tutor.getByRole('region', { name: 'Exame agendado' })).toContainText(/pagamento na clínica/i)
      const [row] = await consultar<{ veterinario_id: string | null; status: string; preco_consulta: string; itens: string }>(
        'select a.veterinario_id,a.status,a.preco_consulta,(select count(*) from agendamento_exames e where e.agendamento_id=a.id) as itens from agendamentos a join pets p on p.id=a.pet_id where a.clinica_id=$1 and p.nome=$2', [labId,pet],
      )
      expect(row).toMatchObject({ veterinario_id: null, status: 'confirmado', itens: '2' })
      expect(Number(row.preco_consulta)).toBe(100)
    })
    await test.step('segundo tutor agenda exame com vaga e não consegue reservar exame já lotado', async () => {
      await segundo.goto(`/exames/${labId}`)
      await segundo.getByRole('checkbox', { name: new RegExp(hemograma) }).check()
      await segundo.getByLabel('Data do exame').fill(dia)
      await expect(segundo.getByRole('radio', { name: '08:00', exact: true })).toHaveCount(0)
      const [exame] = await consultar<{ id: string }>('select id from exames_oferecidos where clinica_id=$1 and nome=$2', [labId,hemograma])
      const [petRow] = await consultar<{ id: string }>('select id from pets where nome=$1', [pet2])
      expect((await segundo.request.post(`/api/exames/clinicas/${labId}/agendar`, {
        data: { exame_ids: [exame.id], pet_id: petRow.id, data: dia, horario: '08:00' },
      })).status()).toBe(409)
      await segundo.getByRole('checkbox', { name: new RegExp(hemograma) }).uncheck()
      await confirmarExame(segundo, urina, pet2, dia)
    })
    let encaminhamentoId = ''
    await test.step('vet encaminha durante atendimento; laboratório sem equipe recebe e aceita', async () => {
      const consulta = await agendarPelaTela(tutor, await idVeterinario('veterinario'), pet)
      await tutor.goto('/dashboard/tutor')
      const codigo = (await cartaoDoPet(tutor, pet).filter({ hasText: 'Código de início' }).locator('.font-mono').textContent())!.trim()
      const emAndamento = await iniciarAtendimentoPelaTela(vet, consulta, pet, codigo)
      await emAndamento.getByRole('button', { name: 'Encaminhar pet' }).click()
      const modal = vet.getByRole('dialog').filter({ hasText: `Encaminhar ${pet}` })
      await modal.getByRole('button', { name: 'Clínica', exact: true }).click()
      await modal.getByLabel('Destino').fill(nome)
      await modal.getByRole('button').filter({ hasText: nome }).first().click()
      await modal.getByLabel('Motivo e contexto').fill(`Solicitar ultrassom no laboratório ${marca}`)
      await modal.getByRole('button', { name: 'Enviar encaminhamento' }).click()
      await expect(modal.getByText(`Encaminhamento enviado para ${nome}`)).toBeVisible()
      await modal.getByRole('button', { name: 'Fechar', exact: true }).last().click()
      await emAndamento.getByRole('button', { name: 'Finalizar Atendimento' }).click()
      const [enc] = await consultar<{ id: string }>('select id from encaminhamentos where destino_clinica_id=$1', [labId]); encaminhamentoId = enc.id
      await lab.goto('/dashboard/clinica')
      const resposta = lab.waitForResponse(r => r.url().endsWith(`/encaminhamentos/${encaminhamentoId}/aceitar`) && r.request().method() === 'POST')
      await lab.locator('#encaminhamentos li').filter({ hasText: marca }).getByRole('button', { name: 'Aceitar', exact: true }).click()
      expect((await resposta).status()).toBe(200)
      await lab.locator('#encaminhamentos').getByRole('button', { name: 'Aceitos', exact: true }).click()
      await expect(lab.locator('#encaminhamentos li').filter({ hasText: marca })).toContainText('Aguardando o tutor agendar.')
    })
    await test.step('tutor segue o encaminhamento até o exame e o vínculo persiste no banco', async () => {
      await tutor.goto('/dashboard/tutor')
      await tutor.locator('#encaminhamentos li').filter({ hasText: marca }).getByRole('link', { name: `Agendar com ${nome}`, exact: true }).click()
      await expect(tutor).toHaveURL(new RegExp(`/clinicas/${labId}\\?encaminhamento=${encaminhamentoId}`))
      await tutor.getByRole('region', { name: 'Exames', exact: true }).getByRole('link', { name: 'Agendar exame', exact: true }).click()
      await expect(tutor).toHaveURL(new RegExp(`/exames/${labId}\\?encaminhamento=${encaminhamentoId}&pet=`))
      await confirmarExame(tutor, imagem, pet, somarDias(dia, 1))
      const [enc] = await consultar<{ agendamento_destino_id: string | null; veterinario_id: string | null; tipo_consulta: string }>(
        'select e.agendamento_destino_id,a.veterinario_id,a.tipo_consulta from encaminhamentos e left join agendamentos a on a.id=e.agendamento_destino_id where e.id=$1', [encaminhamentoId],
      )
      expect(enc.agendamento_destino_id).toBeTruthy(); expect(enc.veterinario_id).toBeNull(); expect(enc.tipo_consulta).toBe('exame')
      await tutor.screenshot({ path: testInfo.outputPath('laboratorio-encaminhamento.png'), fullPage: true })
    })
    expect((await consultar<{ total: string }>('select count(*) as total from veterinario_clinicas where clinica_id=$1', [labId]))[0].total).toBe('0')
  } finally {
    await Promise.all([labCtx.close(), tutorCtx.close(), segundoCtx.close(), vetCtx.close()])
  }
})
