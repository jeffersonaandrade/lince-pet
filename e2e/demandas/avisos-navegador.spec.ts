import type { Page } from '@playwright/test'
import { expect, SEM_SESSAO, sessao, test } from '../fixtures'
import { idVeterinario } from '../agenda'
import { agendarPelaTela, cadastrarPetPelaTela, cancelarPelaTela, dataBR } from '../telas'

const nomePet = (base: string) => `${base} ${Date.now().toString().slice(-6)}`

// O headless antigo (chromium-headless-shell) responde Notification.permission = 'denied' mesmo com a permissão concedida.
test.use({ channel: 'chromium' })

const abrirSino = async (page: Page) => {
  await page.getByRole('banner').getByRole('button', { name: /^Notificações/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Notificações', level: 3 })).toBeVisible()
}

const interruptorDoNavegador = (page: Page) =>
  page.getByRole('checkbox', { name: /Notificações no navegador \(este aparelho\)/ })

test.describe('sino do tutor', () => {
  test.use({ storageState: sessao('tutor') })

  test('depois de agendar pela tela, o tutor vê "Consulta agendada" no sino', async ({ page }) => {
    const vetId = await idVeterinario('veterinario')
    const pet = await cadastrarPetPelaTela(page, nomePet('Sino'))
    const consulta = await agendarPelaTela(page, vetId, pet)

    await page.goto('/dashboard/tutor')
    await abrirSino(page)
    const aviso = page.getByRole('button', { name: /Consulta agendada/ }).filter({ hasText: `${dataBR(consulta.data)} às ${consulta.hora}` })
    await expect(aviso.first()).toBeVisible()

    await page.keyboard.press('Escape')
    await page.goto('/dashboard/tutor')
    await cancelarPelaTela(page, pet, 'Outro motivo')
  })

  test('com a permissão ainda não pedida, o sino convida a ativar as notificações do navegador', async ({ page }) => {
    await page.goto('/dashboard/tutor')
    await abrirSino(page)
    await expect(page.getByRole('button', { name: 'Ativar notificações no navegador' })).toBeVisible()
  })
})

test.describe('interruptor do navegador no perfil', () => {
  test.use({ storageState: sessao('tutor'), permissions: ['notifications'] })

  test('tutor vê o interruptor do aparelho, desligado e pronto para ativar', async ({ page }) => {
    await page.goto('/dashboard/tutor/perfil')
    const interruptor = interruptorDoNavegador(page)
    await expect(interruptor).toBeEnabled()
    await expect(interruptor).not.toBeChecked()
    await expect(page.getByText('Desativadas neste aparelho.')).toBeVisible()

    await test.step('com a permissão já concedida, o sino não repete o convite', async () => {
      await abrirSino(page)
      await expect(page.getByRole('button', { name: 'Ativar notificações no navegador' })).toHaveCount(0)
    })
  })
})

test.describe('clínica também ativa no perfil', () => {
  test.use({ storageState: sessao('clinica'), permissions: ['notifications'] })

  test('o perfil da clínica tem a seção "Avisos" com o interruptor do navegador', async ({ page }) => {
    await page.goto('/dashboard/clinica/perfil')
    await expect(page.getByRole('heading', { name: 'Avisos', exact: true })).toBeVisible()
    await expect(interruptorDoNavegador(page)).toBeEnabled()
  })

  test('invasão (fora da tela): inscrição inválida é recusada', async ({ page }) => {
    const res = await page.request.post('/api/push/inscricao', { data: { endpoint: 'http://inseguro', keys: {} } })
    expect(res.status()).toBe(400)
  })
})

test.describe('visitante', () => {
  test.use({ storageState: SEM_SESSAO })

  test('invasão (fora da tela): sem login não cadastra nem remove aparelho', async ({ page }) => {
    const inscricao = { endpoint: 'https://push.exemplo/x', keys: { p256dh: 'p', auth: 'a' } }
    expect((await page.request.post('/api/push/inscricao', { data: inscricao })).status()).toBe(401)
    expect((await page.request.delete('/api/push/inscricao', { data: { endpoint: inscricao.endpoint } })).status()).toBe(401)
  })
})
