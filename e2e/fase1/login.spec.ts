import { abrirMenuDaConta, CONTAS, SENHA, emailNoMenu, entrar, expect, test, type Perfil } from '../fixtures'

const ERRO_LOGIN = 'Credenciais inválidas. Tente novamente.'
const PERFIS: Perfil[] = ['tutor', 'veterinario', 'clinica', 'prestador']

test.describe('login', () => {
  for (const perfil of PERFIS) {
    test(`${perfil} entra e o menu leva ao painel do seu tipo`, async ({ page }) => {
      const conta = CONTAS[perfil]
      await entrar(page, conta.email)
      await expect(page).toHaveURL('/')

      await abrirMenuDaConta(page)
      await expect(emailNoMenu(page, conta.email)).toBeVisible()
      await page.getByRole('button', { name: 'Perfil' }).click()
      await expect(page).toHaveURL(new RegExp(`${conta.dashboard}$`))
      await page.waitForLoadState('networkidle')
      await expect(page, 'o painel não pode mandar de volta para o onboarding').toHaveURL(new RegExp(`${conta.dashboard}$`))
    })
  }

  test('senha errada e e-mail inexistente mostram a mesma mensagem', async ({ page }) => {
    await entrar(page, CONTAS.tutor.email, 'senha-errada')
    await expect(page.getByText(ERRO_LOGIN)).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)

    await entrar(page, 'ninguem.e2e.mockup@email.com', 'senha-errada')
    await expect(page.getByText(ERRO_LOGIN)).toBeVisible()
  })

  test('e-mail com maiúsculas e espaços entra na mesma conta', async ({ page }) => {
    await entrar(page, `  ${CONTAS.tutor.email.toUpperCase()} `)
    await expect(page).toHaveURL('/')
    await abrirMenuDaConta(page)
    await expect(emailNoMenu(page, CONTAS.tutor.email)).toBeVisible()
  })

  test('link do e-mail sem sessão: o login devolve às próximas consultas', async ({ page }) => {
    await page.goto('/dashboard/tutor#consultas')
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Ftutor%23consultas$/)
    await page.getByLabel('Email').fill(CONTAS.tutor.email)
    await page.getByLabel('Senha', { exact: true }).fill(SENHA)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/dashboard\/tutor#consultas$/)
    const card = page.locator('#consultas')
    await expect(card.getByRole('heading', { name: 'Próximas Consultas' })).toBeVisible()
    await expect(card).toBeInViewport()
  })

  test('next para outro site é ignorado e o login vai para a home', async ({ page }) => {
    await page.goto('/login?next=%2F%2Fmalicioso.com')
    await page.getByLabel('Email').fill(CONTAS.tutor.email)
    await page.getByLabel('Senha', { exact: true }).fill(SENHA)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL('/')
  })

  test('login pela tela: a resposta que chega ao navegador não traz a senha nem tokens', async ({ page }) => {
    const resposta = page.waitForResponse((r) => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST')
    await entrar(page, CONTAS.tutor.email)
    const res = await resposta
    await expect(page).toHaveURL('/')
    expect(res.ok()).toBeTruthy()
    const corpo = await res.text()
    for (const campo of ['"password"', 'googleAccessToken', 'googleRefreshToken', 'remember_me_token']) {
      expect(corpo).not.toContain(campo)
    }
    const cookie = (await page.context().cookies()).find((c) => c.name === 'auth_token')
    expect(cookie?.httpOnly, 'cookie de sessão invisível para o JavaScript da página').toBe(true)
    expect(await page.evaluate(() => document.cookie)).not.toContain('auth_token')
  })
})
