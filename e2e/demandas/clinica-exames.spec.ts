import { randomUUID } from 'node:crypto'
import type { Browser, Locator, Page } from '@playwright/test'
import { expect, sessao, test, type Perfil } from '../fixtures'
import { idClinica, idVeterinario, petsDoTutor } from '../agenda'
import { consultar } from '../db'
import { agendarPelaTela, cadastrarPetPelaTela, cartaoDoPet, dataBR, iniciarAtendimentoPelaTela, somarDias } from '../telas'

async function janela(browser: Browser, perfil: Perfil) {
  const ctx = await browser.newContext({ storageState: sessao(perfil) })
  return { ctx, page: await ctx.newPage() }
}

const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n')

/** Dia útil entre 15 e 45 dias à frente (a clínica do seed atende de segunda a sexta das 8h às 18h). */
function diaUtilFuturo() {
  const hoje = new Date().toISOString().slice(0, 10)
  let dia = somarDias(hoje, 15 + Math.floor(Math.random() * 30))
  while ([0, 6].includes(new Date(`${dia}T12:00:00Z`).getUTCDay())) dia = somarDias(dia, 1)
  return dia
}

async function cadastrarExame(page: Page, exame: { nome: string; preco: string; vagas: string; preparo?: string }) {
  const secao = page.getByRole('region', { name: 'Exames oferecidos' })
  await secao.getByLabel('Nome do exame').fill(exame.nome)
  await secao.getByLabel('Preço (R$)').fill(exame.preco)
  await secao.getByLabel('Duração (minutos)').fill('30')
  await secao.getByLabel('Vagas por horário').fill(exame.vagas)
  if (exame.preparo) await secao.getByLabel('Preparo').fill(exame.preparo)
  await secao.getByRole('button', { name: 'Adicionar exame' }).click()
  await expect(secao.getByRole('listitem', { name: exame.nome })).toBeVisible()
}

/** Clica em "Ver laudo" e confere que a URL assinada devolve o PDF. */
async function abrirLaudo(page: Page, onde: Locator, agendamentoId: string) {
  const resposta = page.waitForResponse((r) => r.url().includes(`/exames/agendamentos/${agendamentoId}/laudo`))
  await onde.getByRole('button', { name: 'Ver laudo' }).click()
  const r = await resposta
  expect(r.status()).toBe(200)
  const pdf = await page.request.get((await r.json()).url)
  expect(pdf.status()).toBe(200)
  expect(pdf.headers()['content-type']).toContain('application/pdf')
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')
}

test('clínica de exames: admin aprova o RT, tutor agenda combo, capacidade esgota e o laudo chega ao prontuário', async ({ browser }) => {
  test.setTimeout(6 * 60_000)
  const marca = randomUUID().slice(0, 6)
  const ultrassom = `Ultrassom ${marca}`
  const raioX = `Raio-X ${marca}`
  const combo = `Check-up ${marca}`
  const clinicaId = await idClinica()
  const [{ nome_clinica: nomeClinica }] = await consultar<{ nome_clinica: string }>(`select nome_clinica from clinicas where id = $1`, [clinicaId])
  const clinica = await janela(browser, 'clinica')
  const tutor = await janela(browser, 'tutor')
  clinica.page.on('dialog', (d) => d.accept())
  const buscaDoExame = `/explorar?tab=exames&search=${encodeURIComponent(marca)}`

  await test.step('clínica liga a agenda, envia um RT novo e cadastra exames e combo', async () => {
    await clinica.page.goto('/dashboard/clinica/exames')
    const modulo = clinica.page.getByLabel('Receber agendamentos de exames')
    await expect(modulo).toBeVisible()
    if (!(await modulo.isChecked())) await modulo.click()
    await expect(modulo).toBeChecked()

    const rt = clinica.page.getByRole('region', { name: 'Responsável técnico' })
    await rt.getByLabel('Nome do responsável técnico').fill(`Dra. RT ${marca}`)
    await rt.getByLabel('CRMV do responsável técnico').fill(`${10000 + Math.floor(Math.random() * 89999)}-SP`)
    await rt.getByRole('button', { name: 'Enviar para análise' }).click()
    await expect(rt.getByText('Enviado para análise da equipe Lince Pet.')).toBeVisible()

    await cadastrarExame(clinica.page, { nome: ultrassom, preco: '150', vagas: '1', preparo: 'Jejum de 8 horas' })
    await cadastrarExame(clinica.page, { nome: raioX, preco: '120', vagas: '2' })

    const combos = clinica.page.getByRole('region', { name: 'Combos' })
    await combos.getByLabel('Nome do combo').fill(combo)
    await combos.getByLabel('Preço do combo (R$)').fill('200')
    await combos.getByLabel(ultrassom).check()
    await combos.getByLabel(raioX).check()
    await combos.getByRole('button', { name: 'Criar combo' }).click()
    await expect(combos.getByRole('listitem', { name: combo })).toBeVisible()
  })

  await test.step('com o RT em análise, os exames não aparecem na busca', async () => {
    await tutor.page.goto(buscaDoExame)
    await expect(tutor.page.getByText(`Nenhuma clínica com o exame "${marca}"`)).toBeVisible()
  })

  await test.step('admin aprova o RT e os exames aparecem na busca', async () => {
    const admin = await janela(browser, 'admin')
    await admin.page.goto('/admin/aprovacoes')
    const pedido = admin.page.getByRole('region', { name: 'RT de clínicas' }).getByRole('listitem', { name: nomeClinica })
    await expect(pedido).toContainText(`Dra. RT ${marca}`)
    await pedido.getByRole('button', { name: 'Aprovar' }).click()
    await expect(admin.page.getByRole('status')).toHaveText('Aprovado. O usuário foi avisado.')
    await admin.ctx.close()

    await tutor.page.goto(buscaDoExame)
    const cartao = tutor.page.getByRole('article', { name: nomeClinica })
    await expect(cartao).toContainText(ultrassom)
    await expect(tutor.page.getByText(/com exames · pagamento na clínica/)).toBeVisible()
  })

  const pet = await cadastrarPetPelaTela(tutor.page, `Exame ${Date.now().toString().slice(-6)}`)
  const dia = diaUtilFuturo()
  let hora = ''

  await test.step('tutor agenda o combo pela tela', async () => {
    await tutor.page.goto(buscaDoExame)
    await tutor.page.getByRole('article', { name: nomeClinica }).getByRole('link', { name: 'Agendar exame' }).click()
    await expect(tutor.page).toHaveURL(`/exames/${clinicaId}`)
    await tutor.page.getByRole('radio', { name: new RegExp(combo) }).check()
    await tutor.page.getByLabel('Data do exame').fill(dia)
    const horarios = tutor.page.getByRole('radiogroup', { name: 'Horários disponíveis' })
    await expect(tutor.page.getByText(/Total: R\$\s?200,00/)).toBeVisible()
    const primeiro = horarios.getByRole('radio').first()
    hora = (await primeiro.textContent())!.trim()
    await primeiro.click()
    await tutor.page.getByRole('region', { name: 'Confirmar agendamento' }).getByRole('combobox').selectOption({ label: pet })
    await tutor.page.getByRole('button', { name: 'Confirmar agendamento' }).click()
    const ok = tutor.page.getByRole('region', { name: 'Exame agendado' })
    await expect(ok).toContainText(`${dataBR(dia)} às ${hora}`)
    await expect(ok).toContainText('Jejum de 8 horas')
  })

  const [exame] = await consultar<{ id: string; preco_consulta: string }>(
    `select a.id, a.preco_consulta from agendamentos a join pets p on p.id = a.pet_id
     where p.nome = $1 and a.tipo_consulta = 'exame' and a.status = 'confirmado'`,
    [pet]
  )
  expect(exame, 'exame gravado e confirmado').toBeTruthy()
  expect(Number(exame.preco_consulta), 'vale o preço do combo').toBe(200)

  await test.step('capacidade esgotada: o horário some para outro tutor e forçar responde 409', async () => {
    const tutor2 = await janela(browser, 'tutor2')
    await tutor2.page.goto(`/exames/${clinicaId}`)
    await tutor2.page.getByRole('checkbox', { name: new RegExp(ultrassom) }).check()
    await tutor2.page.getByLabel('Data do exame').fill(dia)
    await expect(tutor2.page.getByText(/Total: R\$\s?150,00/)).toBeVisible()
    await expect(tutor2.page.getByRole('radio', { name: hora, exact: true })).toHaveCount(0)

    await test.step('invasão (fora da tela): agendar o mesmo horário lotado', async () => {
      const [ultra] = await consultar<{ id: string }>(`select id from exames_oferecidos where nome = $1`, [ultrassom])
      const [petAlheio] = await petsDoTutor('tutor2')
      const res = await tutor2.page.request.post(`/api/exames/clinicas/${clinicaId}/agendar`, {
        data: { exame_ids: [ultra.id], pet_id: petAlheio.id, data: dia, horario: hora },
      })
      expect(res.status()).toBe(409)
    })
    await tutor2.ctx.close()
  })

  await test.step('invasão (fora da tela): laudo antes de o exame estar realizado é recusado', async () => {
    const res = await clinica.page.request.post(`/api/clinicas/exames/agenda/${exame.id}/laudo`, {
      multipart: { laudo: { name: 'laudo.pdf', mimeType: 'application/pdf', buffer: PDF } },
    })
    expect(res.status()).toBe(400)
  })

  // Preparação: só dá para marcar "realizado" depois do horário do exame, então o exame vai para ontem.
  await consultar(
    `update agendamentos set
       inicio_em = inicio_em - (data_consulta::date - (current_date - 1)) * interval '1 day',
       fim_em = fim_em - (data_consulta::date - (current_date - 1)) * interval '1 day',
       data_consulta = to_char(current_date - 1, 'YYYY-MM-DD')
     where id = $1`,
    [exame.id]
  )
  const [{ data_consulta: ontem }] = await consultar<{ data_consulta: string }>(`select data_consulta from agendamentos where id = $1`, [exame.id])

  await test.step('clínica marca realizado e envia o laudo em PDF', async () => {
    await clinica.page.goto('/dashboard/clinica/exames')
    const agenda = clinica.page.getByRole('region', { name: 'Agenda de exames' })
    const de = somarDias(ontem, -1)
    const carregou = clinica.page.waitForResponse((r) => r.url().includes('/clinicas/exames/agenda') && r.url().includes(`de=${de}`))
    await agenda.getByLabel('A partir de').fill(de)
    await carregou
    const item = agenda.getByRole('listitem', { name: `Exame de ${pet}` })
    await expect(item.getByLabel(`Laudo em PDF do exame de ${pet}`), 'laudo só depois de realizado').toHaveCount(0)
    await item.getByRole('button', { name: 'Marcar realizado' }).click()
    await expect(item.getByText('Exame marcado como realizado.')).toBeVisible()
    await item.getByLabel(`Laudo em PDF do exame de ${pet}`).setInputFiles({ name: 'laudo.pdf', mimeType: 'application/pdf', buffer: PDF })
    await expect(item.getByText('Laudo enviado. O tutor foi avisado.')).toBeVisible()
    await expect(item).toContainText('Laudo enviado: laudo.pdf')
  })

  await test.step('tutor vê o laudo no prontuário do pet', async () => {
    await tutor.page.goto('/dashboard/tutor')
    await tutor.page.getByRole('button', { name: `Ver prontuário de ${pet}` }).click()
    const prontuario = tutor.page.getByRole('dialog', { name: `Prontuário de ${pet}` })
    const item = prontuario.getByRole('listitem', { name: `Exame de ${dataBR(ontem)}` })
    await expect(item).toContainText(ultrassom)
    await abrirLaudo(tutor.page, item, exame.id)
  })

  await test.step('vet com consulta do pet vê o laudo no prontuário', async () => {
    const consulta = await agendarPelaTela(tutor.page, await idVeterinario('veterinario'), pet)
    await tutor.page.goto('/dashboard/tutor')
    const codigo = cartaoDoPet(tutor.page, pet).filter({ hasText: 'Código de início' }).locator('.font-mono')
    const vet = await janela(browser, 'veterinario')
    const emAndamento = await iniciarAtendimentoPelaTela(vet.page, consulta, pet, (await codigo.textContent())!.trim())
    await emAndamento.getByRole('button', { name: `Prontuário de ${pet}` }).click()
    const item = emAndamento.getByRole('listitem', { name: `Exame de ${dataBR(ontem)}` })
    await abrirLaudo(vet.page, item, exame.id)
    await emAndamento.getByRole('button', { name: 'Finalizar Atendimento' }).click()
    await vet.ctx.close()
  })

  await test.step('invasão (fora da tela): outro tutor recebe 403 no laudo', async () => {
    const tutor2 = await janela(browser, 'tutor2')
    expect((await tutor2.page.request.get(`/api/exames/agendamentos/${exame.id}/laudo`)).status()).toBe(403)
    await tutor2.ctx.close()
  })

  await test.step('clínica remove o combo e os exames do teste', async () => {
    await clinica.page.goto('/dashboard/clinica/exames')
    const combos = clinica.page.getByRole('region', { name: 'Combos' })
    await combos.getByRole('listitem', { name: combo }).getByRole('button', { name: 'Remover' }).click()
    await expect(combos.getByRole('listitem', { name: combo })).toHaveCount(0)
    const secao = clinica.page.getByRole('region', { name: 'Exames oferecidos' })
    for (const nome of [ultrassom, raioX]) {
      await secao.getByRole('listitem', { name: nome }).getByRole('button', { name: 'Remover' }).click()
      await expect(secao.getByRole('listitem', { name: nome })).toHaveCount(0)
    }
  })

  await tutor.ctx.close()
  await clinica.ctx.close()
})
