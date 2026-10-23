import { randomUUID } from 'node:crypto'
import { expect, sessao, test } from '../fixtures'
import { idVeterinario } from '../agenda'
import { consultar } from '../db'
import { agendarPelaTela, cadastrarPetPelaTela, cartaoDoPet, iniciarAtendimentoPelaTela } from '../telas'

/**
 * Jornada inteira pelas telas, com duas janelas (tutor e vet):
 * agenda duas consultas, remarca uma, cancela a outra, o vet inicia com o código,
 * preenche registro clínico e anotação privada e finaliza; o tutor confere o prontuário de cada pet.
 */

test('jornada completa: agendar, remarcar, cancelar, atender com prontuário e conferir o histórico do pet', async ({ browser }) => {
  test.setTimeout(5 * 60_000)
  const tutorCtx = await browser.newContext({ storageState: sessao('tutor'), viewport: { width: 1100, height: 900 } })
  const vetCtx = await browser.newContext({ storageState: sessao('veterinario'), viewport: { width: 1100, height: 900 } })
  const tutor = await tutorCtx.newPage()
  const vet = await vetCtx.newPage()
  const vetId = await idVeterinario('veterinario')
  const sufixo = Date.now().toString().slice(-5)
  const thor = { nome: `Thor ${sufixo}` }
  const mel = { nome: `Mel ${sufixo}` }

  await test.step(`0. Tutor cadastra ${thor.nome} e ${mel.nome} pelo painel`, async () => {
    await cadastrarPetPelaTela(tutor, thor.nome)
    await cadastrarPetPelaTela(tutor, mel.nome)
  })

  const diagnostico = `Otite externa leve ${randomUUID().slice(0, 6)}`
  const segredo = `Nota privada do vet ${randomUUID().slice(0, 6)}`

  let a: Awaited<ReturnType<typeof agendarPelaTela>>
  let b: Awaited<ReturnType<typeof agendarPelaTela>>

  await test.step(`1. Tutor agenda consulta para ${thor.nome}`, async () => {
    a = await agendarPelaTela(tutor, vetId, thor.nome)
  })

  await test.step(`2. Tutor agenda outra consulta para ${mel.nome}`, async () => {
    b = await agendarPelaTela(tutor, vetId, mel.nome)
  })

  await test.step('3. As duas aparecem em "Próximas Consultas" do tutor', async () => {
    await tutor.goto('/dashboard/tutor')
    await expect(cartaoDoPet(tutor, thor.nome)).toContainText(a.hora)
    await expect(cartaoDoPet(tutor, mel.nome)).toContainText(b.hora)
  })

  let novaHora = ''
  await test.step(`4. Tutor remarca a consulta de ${thor.nome} para outro horário`, async () => {
    await cartaoDoPet(tutor, thor.nome).getByRole('button', { name: 'Reagendar' }).click()
    const modal = tutor.getByRole('dialog', { name: 'Reagendar Consulta' })
    await expect(modal).toBeVisible()
    const outro = modal.getByRole('button', { name: /^\d{2}:\d{2}$/, pressed: false }).first()
    await expect(outro).toBeVisible()
    novaHora = (await outro.textContent())!.trim()
    await outro.click()
    await modal.getByRole('button', { name: 'Confirmar Reagendamento' }).click()
    await expect(modal).toBeHidden()
    await expect(cartaoDoPet(tutor, thor.nome)).toContainText(novaHora)
    await expect
      .poll(async () => (await consultar<{ h: string }>(`select horario_consulta h from agendamentos where id = $1`, [a.id]))[0].h)
      .toBe(novaHora)
  })

  await test.step(`5. Tutor cancela a consulta de ${mel.nome} escolhendo o motivo`, async () => {
    await cartaoDoPet(tutor, mel.nome).getByRole('button', { name: 'Cancelar', exact: true }).click()
    const modal = tutor.getByRole('dialog', { name: 'Cancelar Consulta' })
    await modal.getByRole('radio').first().check()
    await modal.getByRole('button', { name: 'Confirmar Cancelamento' }).click()
    await expect(modal).toBeHidden()
    await expect
      .poll(async () => (await consultar<{ s: string }>(`select status s from agendamentos where id = $1`, [b.id]))[0].s)
      .toBe('cancelado')
    await tutor.reload()
    await expect(cartaoDoPet(tutor, mel.nome)).toContainText(/cancelad/i)
    await expect(cartaoDoPet(tutor, mel.nome).getByRole('button', { name: 'Reagendar' })).toHaveCount(0)
  })

  let codigo = ''
  await test.step('6. Tutor vê o código de início no painel', async () => {
    const cartao = cartaoDoPet(tutor, thor.nome)
    await expect(cartao).toContainText('Código de início')
    codigo = (await cartao.locator('.font-mono').textContent())!.trim()
    expect(codigo).toMatch(/^\w{4,8}$/)
  })

  await test.step('7. Vet abre o dia da consulta e inicia com o código do tutor', async () => {
    await iniciarAtendimentoPelaTela(vet, { data: a.data, hora: novaHora }, thor.nome, codigo)
  })

  const consultaVet = vet.getByRole('dialog').filter({ hasText: 'Consulta em Andamento' })

  await test.step('8. Vet preenche o registro clínico (vai para o prontuário do pet)', async () => {
    await expect(consultaVet).toBeVisible()
    await consultaVet.getByLabel('Peso (kg)').fill('12.5')
    await consultaVet.getByLabel('Motivo / queixa principal').fill('Coçando a orelha há 3 dias')
    await consultaVet.getByLabel('Diagnóstico / avaliação').fill(diagnostico)
    await consultaVet.getByLabel('Tratamento / prescrição e orientações').fill('Limpeza diária e gotas otológicas por 7 dias')
    await consultaVet.getByRole('button', { name: 'Salvar registro' }).click()
    await expect(consultaVet.getByRole('status').filter({ hasText: 'Registro clínico salvo.' })).toBeVisible()
  })

  await test.step('9. Vet escreve a anotação privada (só ele vê)', async () => {
    await consultaVet.getByLabel('Observações do paciente').fill(segredo)
    await consultaVet.getByRole('button', { name: 'Salvar anotação' }).click()
    await expect(consultaVet.getByRole('status').filter({ hasText: 'Anotação salva.' })).toBeVisible()
  })

  await test.step('10. Vet finaliza o atendimento', async () => {
    await consultaVet.getByRole('button', { name: 'Finalizar Atendimento' }).click()
    await expect
      .poll(async () => (await consultar<{ s: string }>(`select status s from agendamentos where id = $1`, [a.id]))[0].s)
      .toBe('realizado')
  })

  await test.step(`11. Tutor abre o prontuário de ${thor.nome}: registro aparece, anotação privada não`, async () => {
    await tutor.goto('/dashboard/tutor')
    await tutor.getByRole('button', { name: `Ver prontuário de ${thor.nome}` }).click()
    const prontuario = tutor.getByRole('dialog', { name: `Prontuário de ${thor.nome}` })
    await expect(prontuario.getByText('Com registro')).toBeVisible()
    await expect(prontuario.getByText('Último peso:')).toContainText('12.5 kg')
    await prontuario.getByText('Com registro').click()
    await expect(prontuario.getByText(diagnostico)).toBeVisible()
    await expect(prontuario).not.toContainText(segredo)
    await prontuario.getByRole('button', { name: 'Fechar' }).click()
  })

  await test.step(`12. O prontuário de ${mel.nome} continua vazio (histórico é por pet)`, async () => {
    await tutor.getByRole('button', { name: `Ver prontuário de ${mel.nome}` }).click()
    const prontuario = tutor.getByRole('dialog', { name: `Prontuário de ${mel.nome}` })
    await expect(prontuario.getByText('Este pet ainda não tem registros.')).toBeVisible()
    await expect(prontuario).not.toContainText(diagnostico)
  })

  await tutorCtx.close()
  await vetCtx.close()
})
