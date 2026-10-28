import type { Page } from '@playwright/test'
import { cadastrarTutorPelaTela, CONTAS, expect, SEM_SESSAO, sessao, test } from '../fixtures'
import { consultar } from '../db'

const emailNoBanco = async (email: string) => {
  const [linha] = await consultar<{ notificar_email: number | boolean }>(
    `select notificar_email from users where email = $1`,
    [email]
  )
  return Boolean(linha.notificar_email)
}

const secaoDeAvisos = (page: Page) => {
  const secao = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Avisos de consulta' }) })
  return {
    secao,
    email: secao.getByRole('checkbox', { name: /^E-mail/ }),
  }
}

test.describe('canais de aviso pela tela', () => {
  test.use({ storageState: SEM_SESSAO })

  test('tutor novo desliga e religa e-mail no perfil e a escolha persiste', async ({ page }) => {
    const email = await cadastrarTutorPelaTela(page)
    expect(await emailNoBanco(email)).toBe(true)
    await page.goto('/dashboard/tutor/perfil')

    const { email: checkEmail } = secaoDeAvisos(page)
    await expect(checkEmail).toBeEnabled()
    await expect(checkEmail).toBeChecked()
    await expect(page.getByRole('checkbox', { name: /^WhatsApp/ })).toHaveCount(0)

    await checkEmail.uncheck()
    await expect(page.getByText('Preferência de aviso salva.').first()).toBeVisible()
    await expect.poll(() => emailNoBanco(email), 'e-mail desligado').toBe(false)

    await page.reload()
    await expect(checkEmail).toBeEnabled()
    await expect(checkEmail).not.toBeChecked()

    await checkEmail.check()
    await expect.poll(() => emailNoBanco(email)).toBe(true)
  })

  test('visitante sem login não chega à tela de avisos', async ({ page }) => {
    await page.goto('/dashboard/tutor/perfil')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Avisos de consulta' })).toHaveCount(0)

    await test.step('invasão (fora da tela): a rota de avisos sem login responde 401', async () => {
      expect((await page.request.get('/api/me/notificacoes')).status()).toBe(401)
      expect((await page.request.put('/api/me/notificacoes', { data: { email: false } })).status()).toBe(401)
    })
  })
})

test.describe('canais do vet pela tela', () => {
  test.use({ storageState: sessao('veterinario') })

  test('vet alterna o e-mail no perfil: só esse canal muda e a escolha persiste', async ({ page }) => {
    const email = CONTAS.veterinario.email
    const antes = await emailNoBanco(email)
    await page.goto('/dashboard/veterinario/perfil')
    const { email: checkEmail } = secaoDeAvisos(page)
    await expect(checkEmail).toBeEnabled()
    await expect(checkEmail).toBeChecked({ checked: antes })
    await expect(page.getByRole('checkbox', { name: /^WhatsApp/ })).toHaveCount(0)

    try {
      await checkEmail.setChecked(!antes)
      await expect(page.getByText('Preferência de aviso salva.').first()).toBeVisible()
      await expect.poll(() => emailNoBanco(email)).toBe(!antes)
      await page.reload()
      await expect(checkEmail).toBeChecked({ checked: !antes })
    } finally {
      await expect(checkEmail).toBeEnabled()
      await checkEmail.setChecked(antes)
      await expect.poll(() => emailNoBanco(email)).toBe(antes)
    }
  })
})

test.describe('clínica não tem canais', () => {
  test.use({ storageState: sessao('clinica') })

  test('o painel da clínica não mostra "Avisos de consulta"', async ({ page }) => {
    await page.goto('/dashboard/clinica/perfil')
    await expect(page.getByRole('heading').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Avisos de consulta' })).toHaveCount(0)

    await test.step('invasão (fora da tela): a rota de avisos responde 403 para clínica', async () => {
      expect((await page.request.get('/api/me/notificacoes')).status()).toBe(403)
    })
  })
})
