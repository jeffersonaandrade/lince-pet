import type { Page } from '@playwright/test'
import { cadastrarTutorPelaTela, CONTAS, expect, SEM_SESSAO, sessao, test } from '../fixtures'
import { consultar } from '../db'

const canaisNoBanco = async (email: string) => {
  const [linha] = await consultar<{ notificar_email: number | boolean; notificar_whatsapp: number | boolean }>(
    `select notificar_email, notificar_whatsapp from users where email = $1`,
    [email]
  )
  return { email: Boolean(linha.notificar_email), whatsapp: Boolean(linha.notificar_whatsapp) }
}

const secaoDeAvisos = (page: Page) => {
  const secao = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Avisos de consulta' }) })
  return {
    secao,
    email: secao.getByRole('checkbox', { name: /^E-mail/ }),
    whatsapp: secao.getByRole('checkbox', { name: /^WhatsApp/ }),
  }
}

test.describe('canais de aviso pela tela', () => {
  test.use({ storageState: SEM_SESSAO })

  test('tutor novo desliga e religa e-mail e WhatsApp no perfil e a escolha persiste', async ({ page }) => {
    const email = await cadastrarTutorPelaTela(page)
    expect(await canaisNoBanco(email)).toEqual({ email: true, whatsapp: true })
    await page.goto('/dashboard/tutor/perfil')

    const { email: checkEmail, whatsapp: checkWhats } = secaoDeAvisos(page)
    await expect(checkEmail).toBeEnabled()
    await expect(checkEmail).toBeChecked()
    await expect(checkWhats).toBeChecked()

    await checkEmail.uncheck()
    await expect(page.getByText('Preferência de aviso salva.').first()).toBeVisible()
    await expect.poll(() => canaisNoBanco(email), 'só o e-mail mudou').toEqual({ email: false, whatsapp: true })

    await checkWhats.uncheck()
    await expect.poll(() => canaisNoBanco(email)).toEqual({ email: false, whatsapp: false })

    await page.reload()
    await expect(checkEmail).toBeEnabled()
    await expect(checkEmail).not.toBeChecked()
    await expect(checkWhats).not.toBeChecked()

    await checkEmail.check()
    await expect.poll(() => canaisNoBanco(email)).toEqual({ email: true, whatsapp: false })
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

  test('vet alterna o WhatsApp no perfil: só esse canal muda e a escolha persiste', async ({ page }) => {
    const email = CONTAS.veterinario.email
    const antes = await canaisNoBanco(email)
    await page.goto('/dashboard/veterinario/perfil')
    const { whatsapp } = secaoDeAvisos(page)
    await expect(whatsapp).toBeEnabled()
    await expect(whatsapp).toBeChecked({ checked: antes.whatsapp })

    try {
      await whatsapp.setChecked(!antes.whatsapp)
      await expect(page.getByText('Preferência de aviso salva.').first()).toBeVisible()
      await expect.poll(() => canaisNoBanco(email)).toEqual({ email: antes.email, whatsapp: !antes.whatsapp })
      await page.reload()
      await expect(whatsapp).toBeChecked({ checked: !antes.whatsapp })
    } finally {
      await expect(whatsapp).toBeEnabled()
      await whatsapp.setChecked(antes.whatsapp)
      await expect.poll(() => canaisNoBanco(email)).toEqual(antes)
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
