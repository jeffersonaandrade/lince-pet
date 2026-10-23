import { randomUUID } from 'node:crypto'
import type { Browser, Locator, Page } from '@playwright/test'
import { CONTAS, expect, sessao, test, type Perfil } from '../fixtures'
import { idClinica, idPrestador, idVeterinario } from '../agenda'
import { consultar } from '../db'
import { abrirConsultaNoPainelDoVet, agendarPelaTela, cadastrarPetPelaTela, codigoDeInicio, iniciarAtendimentoPelaTela } from '../telas'

async function janela(browser: Browser, perfil: Perfil) {
  const ctx = await browser.newContext({ storageState: sessao(perfil) })
  return { ctx, page: await ctx.newPage() }
}

const nomeDoVet = async (perfil: 'veterinario' | 'veterinario2') =>
  (
    await consultar<{ nome: string }>(
      `select u.nome || ' ' || u.sobrenome as nome from veterinarios v join users u on u.id = v.user_id where v.id = $1`,
      [await idVeterinario(perfil)]
    )
  )[0].nome

/** No modal "Encaminhar {pet}": escolhe o tipo, busca o destino pelo nome e envia. */
async function encaminharPelaTela(
  emAndamento: Locator,
  page: Page,
  pet: string,
  destino: { tipo: 'Veterinário especialista' | 'Clínica' | 'Profissional pet'; nome: string },
  motivo: string,
  urgencia: 'rotina' | 'prioritario' = 'rotina'
) {
  const modal = page.getByRole('dialog').filter({ hasText: `Encaminhar ${pet}` })
  if (!(await modal.isVisible())) await emAndamento.getByRole('button', { name: 'Encaminhar pet' }).click()
  await expect(modal).toBeVisible()
  await modal.getByRole('button', { name: destino.tipo, exact: true }).click()
  await modal.getByLabel('Destino').fill(destino.nome)
  await modal.getByRole('button').filter({ hasText: destino.nome }).first().click()
  await modal.getByLabel('Motivo e contexto').fill(motivo)
  await modal.getByLabel('Urgência').selectOption(urgencia)
  await modal.getByRole('button', { name: 'Enviar encaminhamento' }).click()
  return modal
}

const itemRecebido = (page: Page, texto: string) => page.locator('#encaminhamentos li').filter({ hasText: texto })

test('encaminhamento pela tela: vet envia, especialista recusa, prestador aceita e o tutor acompanha', async ({ browser }) => {
  test.setTimeout(6 * 60_000)
  const tutor = await janela(browser, 'tutor')
  const vet = await janela(browser, 'veterinario')
  const [vet2Nome, bianca, clinicaId] = await Promise.all([nomeDoVet('veterinario2'), idPrestador(), idClinica()])
  const [{ nome_clinica: clinicaNome }] = await consultar<{ nome_clinica: string }>(`select nome_clinica from clinicas where id = $1`, [clinicaId])
  const marca = randomUUID().slice(0, 6)
  const pet = await cadastrarPetPelaTela(tutor.page, `Encaminhado ${Date.now().toString().slice(-6)}`)
  const consulta = await agendarPelaTela(tutor.page, await idVeterinario('veterinario'), pet)

  await test.step('antes de iniciar o atendimento não há botão "Encaminhar pet"', async () => {
    await abrirConsultaNoPainelDoVet(vet.page, consulta, pet)
    const detalhes = vet.page.getByRole('dialog').filter({ hasText: 'Detalhes e Início da Consulta' })
    await expect(detalhes).toBeVisible()
    await expect(detalhes.getByRole('button', { name: 'Encaminhar pet' })).toHaveCount(0)
    await test.step('invasão (fora da tela): encaminhar antes do início é recusado', async () => {
      const res = await vet.page.request.post(`/api/agendamentos/${consulta.id}/encaminhamentos`, {
        data: { destino_tipo: 'veterinario', destino_id: await idVeterinario('veterinario2'), motivo: 'Avaliar' },
      })
      expect(res.status()).toBe(400)
    })
  })

  const emAndamento = await iniciarAtendimentoPelaTela(vet.page, consulta, pet, await codigoDeInicio(tutor.page, pet))
  const cardio = `Suspeita de sopro ${marca}`
  const tosa = `Tosa higiênica ${marca}`
  const exames = `Exames de imagem ${marca}`

  await test.step('vet encaminha para o especialista (prioritário)', async () => {
    const modal = vet.page.getByRole('dialog').filter({ hasText: `Encaminhar ${pet}` })
    await emAndamento.getByRole('button', { name: 'Encaminhar pet' }).click()
    await modal.getByRole('button', { name: 'Veterinário especialista', exact: true }).click()
    await modal.getByLabel('Destino').fill(vet2Nome)
    await modal.getByRole('button').filter({ hasText: vet2Nome }).first().click()
    await modal.getByLabel('Motivo e contexto').fill('x')
    await expect(modal.getByRole('button', { name: 'Enviar encaminhamento' }), 'motivo curto não envia').toBeDisabled()

    await encaminharPelaTela(emAndamento, vet.page, pet, { tipo: 'Veterinário especialista', nome: vet2Nome }, cardio, 'prioritario')
    await expect(modal.getByText(`Encaminhamento enviado para ${vet2Nome}`)).toBeVisible()
    await expect(modal.getByText('Encaminhamentos desta consulta')).toBeVisible()
  })

  await test.step('mandar de novo para o mesmo especialista mostra erro', async () => {
    const modal = await encaminharPelaTela(emAndamento, vet.page, pet, { tipo: 'Veterinário especialista', nome: vet2Nome }, `${cardio} de novo`)
    await expect(modal.locator('.border-red-200')).toBeVisible()
  })

  await test.step('vet encaminha para o profissional pet e para a clínica', async () => {
    const modal = await encaminharPelaTela(emAndamento, vet.page, pet, { tipo: 'Profissional pet', nome: bianca.nome }, tosa)
    await expect(modal.getByText(`Encaminhamento enviado para ${bianca.nome}`)).toBeVisible()
    await encaminharPelaTela(emAndamento, vet.page, pet, { tipo: 'Clínica', nome: clinicaNome }, exames)
    await expect(modal.getByText(`Encaminhamento enviado para ${clinicaNome}`)).toBeVisible()
    await modal.getByRole('button', { name: 'Fechar', exact: true }).last().click()
  })

  await test.step('especialista vê o pedido e o prontuário, sem o contato do tutor, e recusa com motivo', async () => {
    const vet2 = await janela(browser, 'veterinario2')
    await vet2.page.goto('/dashboard/veterinario')
    const item = itemRecebido(vet2.page, cardio)
    await expect(item).toBeVisible()
    await expect(item).toContainText(pet)
    await expect(item).not.toContainText(CONTAS.tutor.email)
    await item.getByRole('button', { name: 'Ver prontuário' }).click()
    await expect(item.getByRole('button', { name: 'Ocultar prontuário' })).toBeVisible()

    await item.getByRole('button', { name: 'Recusar' }).click()
    await expect(item.getByRole('button', { name: 'Confirmar recusa' }), 'recusa exige motivo').toBeDisabled()
    await item.getByPlaceholder('Motivo da recusa (o tutor verá esta mensagem)').fill('Sem agenda este mês')
    await item.getByRole('button', { name: 'Confirmar recusa' }).click()
    await expect(itemRecebido(vet2.page, cardio)).toHaveCount(0)

    await vet2.page.locator('#encaminhamentos').getByRole('button', { name: 'Recusados' }).click()
    const recusado = itemRecebido(vet2.page, cardio)
    await expect(recusado).toContainText('Motivo da recusa: Sem agenda este mês')
    await expect(recusado.getByRole('button', { name: 'Ver prontuário' }), 'recusado perde o prontuário').toHaveCount(0)
    await vet2.ctx.close()
  })

  await test.step('profissional pet aceita e passa a ver o prontuário', async () => {
    const prestador = await janela(browser, 'prestador')
    await prestador.page.goto('/dashboard/prestador')
    await itemRecebido(prestador.page, tosa).getByRole('button', { name: 'Aceitar' }).click()
    await prestador.page.locator('#encaminhamentos').getByRole('button', { name: 'Aceitos' }).click()
    const aceito = itemRecebido(prestador.page, tosa)
    await expect(aceito).toContainText('Aguardando o tutor agendar.')
    await aceito.getByRole('button', { name: 'Ver prontuário' }).click()
    await expect(aceito.getByRole('button', { name: 'Ocultar prontuário' })).toBeVisible()
    await prestador.ctx.close()
  })

  await test.step('tutor acompanha: recusa com motivo, atalho de agendar no aceito e aguardando na clínica', async () => {
    await tutor.page.goto('/dashboard/tutor')
    await expect(itemRecebido(tutor.page, cardio)).toContainText('Recusado: Sem agenda este mês')
    const link = itemRecebido(tutor.page, tosa).getByRole('link', { name: new RegExp(`Agendar com ${bianca.nome}`) })
    await expect(link).toBeVisible()
    await expect(itemRecebido(tutor.page, exames)).toContainText(`Aguardando resposta de ${clinicaNome}`)
    await link.click()
    await expect(tutor.page).toHaveURL(new RegExp(`/profissionais/${bianca.id}\\?encaminhamento=`))
  })

  await test.step('outro tutor não vê esses encaminhamentos', async () => {
    const tutor2 = await janela(browser, 'tutor2')
    await tutor2.page.goto('/dashboard/tutor')
    await expect(tutor2.page.getByRole('heading').first()).toBeVisible()
    await expect(tutor2.page.locator('body')).not.toContainText(marca)
    await tutor2.ctx.close()
  })

  await abrirConsultaNoPainelDoVet(vet.page, consulta, pet)
  await vet.page.getByRole('dialog').filter({ hasText: 'Consulta em Andamento' }).getByRole('button', { name: 'Finalizar Atendimento' }).click()
  await tutor.ctx.close()
  await vet.ctx.close()
})
