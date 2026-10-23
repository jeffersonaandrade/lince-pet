import { CONTAS, entrar, expect, ipUnico, test } from '../fixtures'

const LIMITE = 'Muitas tentativas. Tente novamente em alguns minutos.'

// Cada teste tem um IP próprio (x-forwarded-for do fixture), então o bloqueio não vaza para os outros.
test.describe('limite de tentativas pela tela', () => {
  test('login: 10 senhas erradas; na 11ª nem a senha certa entra e a tela avisa o limite; outro IP entra', async ({ page, browser }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(CONTAS.tutor.email)
    const senha = page.getByLabel('Senha', { exact: true })
    const entrarBotao = page.getByRole('button', { name: 'Entrar' })
    for (let i = 1; i <= 10; i++) {
      await test.step(`tentativa ${i} com senha errada`, async () => {
        await senha.fill(`errada-${i}`)
        const resposta = page.waitForResponse((r) => r.url().endsWith('/api/auth/login'))
        await entrarBotao.click()
        expect([400, 401]).toContain((await resposta).status())
        await expect(page.getByText('Credenciais inválidas. Tente novamente.')).toBeVisible()
      })
    }

    await test.step('11ª tentativa, com a senha certa', async () => {
      const resposta = page.waitForResponse((r) => r.url().endsWith('/api/auth/login'))
      await senha.fill('senha123')
      await entrarBotao.click()
      expect((await resposta).status()).toBe(429)
      await expect(page.getByText(LIMITE)).toBeVisible()
      await expect(page).toHaveURL(/\/login$/)
    })

    await test.step('outro computador (outro IP) entra normalmente', async () => {
      const outro = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': ipUnico() } })
      const pagina = await outro.newPage()
      await entrar(pagina, CONTAS.tutor.email)
      await expect(pagina).toHaveURL('/')
      await outro.close()
    })
  })

  test('esqueci a senha: 5 pedidos passam; o 6º mostra o aviso de limite', async ({ page }) => {
    await page.goto('/forgot-password')
    const enviar = page.getByRole('button', { name: 'Enviar link de recuperação' })
    for (let i = 1; i <= 5; i++) {
      await test.step(`pedido ${i}`, async () => {
        await page.goto('/forgot-password')
        await page.getByLabel('Email').fill('ninguem.e2e.mockup@email.com')
        await enviar.click()
        await expect(page.getByText(/Se (esse|o) e-mail estiver cadastrado/i)).toBeVisible()
      })
    }
    await test.step('6º pedido', async () => {
      await page.goto('/forgot-password')
      await page.getByLabel('Email').fill('ninguem.e2e.mockup@email.com')
      await enviar.click()
      await expect(page.getByText(LIMITE)).toBeVisible()
    })
  })
})
