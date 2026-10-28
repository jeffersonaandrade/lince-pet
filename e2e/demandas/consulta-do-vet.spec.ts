import { randomUUID } from 'node:crypto'
import type { Browser } from '@playwright/test'
import { CONTAS, expect, sessao, test, type Perfil } from '../fixtures'
import { idVeterinario } from '../agenda'
import { consultar } from '../db'
import { abrirConsultaNoPainelDoVet, agendarPelaTela, cadastrarPetPelaTela, cancelarPelaTela, codigoDeInicio, hojeNoNavegador } from '../telas'

const nomePet = (base: string) => `${base} ${Date.now().toString().slice(-6)}`

async function janela(browser: Browser, perfil: Perfil) {
  const ctx = await browser.newContext({ storageState: sessao(perfil) })
  return { ctx, page: await ctx.newPage() }
}

test.describe('consulta no painel do vet: contato do tutor e anotação privada', () => {
  test.use({ storageState: sessao('veterinario') })

  test('contato do tutor aparece; anotação só depois do início e persiste', async ({ page, browser }) => {
    test.setTimeout(3 * 60_000)
    const tutor = await janela(browser, 'tutor')
    const pet = await cadastrarPetPelaTela(tutor.page, nomePet('Amora'))
    const consulta = await agendarPelaTela(tutor.page, await idVeterinario('veterinario'), pet)
    const codigoCerto = await codigoDeInicio(tutor.page, pet)
    const [dadosTutor] = await consultar<{ email: string; celular: string }>(`select email, celular from users where email = $1`, [CONTAS.tutor.email])

    await abrirConsultaNoPainelDoVet(page, consulta, pet)
    const modalCodigo = page.getByRole('dialog').filter({ hasText: 'Detalhes e Início da Consulta' })
    await expect(modalCodigo).toBeVisible()
    await expect(modalCodigo.getByText(dadosTutor.email)).toHaveAttribute('href', `mailto:${dadosTutor.email}`)
    await expect(modalCodigo.getByRole('link', { name: /WhatsApp/i })).toHaveCount(0)
    await expect(modalCodigo.getByText('Minhas anotações'), 'antes do início não há anotação').toHaveCount(0)

    const codigo = modalCodigo.getByLabel('Código de início da consulta')
    await codigo.fill('000000')
    await modalCodigo.getByRole('button', { name: 'Confirmar e Iniciar' }).click()
    await expect(modalCodigo.getByRole('alert')).toContainText(/inválido/i)

    await codigo.fill(codigoCerto)
    await modalCodigo.getByRole('button', { name: 'Confirmar e Iniciar' }).click()
    await expect(modalCodigo).toBeHidden()

    await abrirConsultaNoPainelDoVet(page, consulta, pet)
    const modal = page.getByRole('dialog').filter({ hasText: 'Consulta em Andamento' })
    await expect(modal.getByText('Minhas anotações')).toBeVisible()
    await expect(modal.getByText('Privado: só você vê')).toBeVisible()

    const observacao = `Obs privada ${randomUUID().slice(0, 8)}`
    await modal.getByLabel('Local do atendimento').selectOption('Online')
    await modal.getByLabel(/^Pagamento/).selectOption('pago')
    await modal.getByLabel('Forma de pagamento').selectOption('plano_pet')
    await modal.getByLabel('Plano usado').fill('Pet Love')
    await modal.getByLabel('Observações do paciente').fill(observacao)
    await modal.getByRole('button', { name: 'Salvar anotação' }).click()
    await expect(modal.getByRole('status').filter({ hasText: 'Anotação salva.' })).toBeVisible()

    await abrirConsultaNoPainelDoVet(page, consulta, pet)
    const reaberto = page.getByRole('dialog').filter({ hasText: 'Consulta em Andamento' })
    await expect(reaberto.getByLabel('Observações do paciente')).toHaveValue(observacao)
    await expect(reaberto.getByLabel('Forma de pagamento')).toHaveValue('plano_pet')
    await expect(reaberto.getByLabel('Plano usado')).toHaveValue('Pet Love')

    await tutor.page.goto('/dashboard/tutor')
    await expect(tutor.page.locator('body')).not.toContainText(observacao)
    const [{ payment_status }] = await consultar<{ payment_status: string }>(`select payment_status from agendamentos where id = $1`, [consulta.id])
    expect(payment_status).toBe('unpaid')

    await reaberto.getByRole('button', { name: 'Finalizar Atendimento' }).click()
    await tutor.ctx.close()
  })
})

test.describe('contato do tutor só para o vet da consulta', () => {
  test.use({ storageState: sessao('tutor') })

  test('outro vet, a clínica e outro tutor não veem a consulta nem o contato', async ({ page, browser }) => {
    test.setTimeout(3 * 60_000)
    const pet = await cadastrarPetPelaTela(page, nomePet('Paçoca'))
    const consulta = await agendarPelaTela(page, await idVeterinario('veterinario'), pet)

    await test.step('o vet da consulta vê o e-mail do tutor', async () => {
      const vet = await janela(browser, 'veterinario')
      await abrirConsultaNoPainelDoVet(vet.page, consulta, pet)
      await expect(vet.page.getByRole('dialog').filter({ hasText: 'Detalhes e Início da Consulta' })).toContainText(CONTAS.tutor.email)
      await vet.ctx.close()
    })

    await test.step('outro vet: o dia da consulta não tem esse pet', async () => {
      const vet2 = await janela(browser, 'veterinario2')
      await vet2.page.goto('/dashboard/veterinario')
      const dias = Math.round((Date.parse(consulta.data) - Date.parse(await hojeNoNavegador(vet2.page))) / 86_400_000)
      for (let i = 0; i < dias; i++) await vet2.page.getByRole('button', { name: 'Próximo dia' }).click()
      await expect(vet2.page.getByRole('article', { name: new RegExp(`e pet ${pet}`) })).toHaveCount(0)
      await expect(vet2.page.locator('body')).not.toContainText(CONTAS.tutor.email)
      await test.step('invasão (fora da tela): lista de consultas do outro vet pela API', async () => {
        const corpo = await (await vet2.page.request.get('/api/veterinarios/agendamentos')).text()
        expect(corpo).not.toContain(consulta.id)
      })
      await vet2.ctx.close()
    })

    for (const perfil of ['clinica', 'tutor2'] as const) {
      await test.step(`${perfil}: o painel não mostra o pet nem o contato`, async () => {
        const outro = await janela(browser, perfil)
        await outro.page.goto(CONTAS[perfil].dashboard)
        await expect(outro.page.getByRole('heading').first()).toBeVisible()
        await expect(outro.page.locator('body')).not.toContainText(pet)
        await outro.ctx.close()
      })
    }

    await cancelarPelaTela(page, pet, 'Outro motivo')
  })
})
