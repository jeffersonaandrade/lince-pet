import type { Page } from '@playwright/test'
import { tokenDeRedefinicao } from '../db'
import { cadastrarTutorPelaTela, entrar, expect, loginQueVoltaPara, SEM_SESSAO, SENHA, sair, test } from '../fixtures'

const MENSAGEM_GENERICA = /Se esse e-mail estiver cadastrado|Se o e-mail estiver cadastrado/i

async function pedirLink(page: Page, email: string) {
  await page.goto('/forgot-password')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click()
}

async function redefinir(page: Page, token: string, senha: string) {
  await page.goto(`/reset-password?token=${token}`)
  await page.getByLabel('Nova Senha', { exact: true }).fill(senha)
  await page.getByLabel('Confirmar Nova Senha').fill(senha)
  await page.getByRole('button', { name: 'Redefinir Senha' }).click()
}

test.use({ storageState: SEM_SESSAO })

test.describe('esqueci a senha', () => {
  test('mesma resposta para e-mail cadastrado e inexistente', async ({ page }) => {
    const email = await cadastrarTutorPelaTela(page)
    await sair(page)
    await pedirLink(page, email)
    const existente = await page.getByText(MENSAGEM_GENERICA).innerText()

    await pedirLink(page, 'ninguem.e2e.mockup@email.com')
    const inexistente = await page.getByText(MENSAGEM_GENERICA).innerText()

    expect(inexistente).toBe(existente)
  })

  test('link redefine a senha, derruba a sessão aberta em outro navegador e só vale uma vez', async ({ page, browser }) => {
    const antiga = await browser.newContext({ storageState: SEM_SESSAO })
    const paginaAntiga = await antiga.newPage()
    const email = await cadastrarTutorPelaTela(paginaAntiga)
    await paginaAntiga.goto('/dashboard/tutor')
    await expect(paginaAntiga).toHaveURL(/\/dashboard\/tutor$/)

    await pedirLink(page, email)
    await expect(page.getByText(MENSAGEM_GENERICA)).toBeVisible()
    // O e-mail não sai no e2e (MAIL_DRIVER=log): o token do link vem do banco local.
    const token = await tokenDeRedefinicao(email)

    await redefinir(page, token, 'novaSenha456')
    await expect(page.getByText('Sua senha foi redefinida com sucesso!')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 })

    await test.step('o navegador que estava logado perde a sessão', async () => {
      await paginaAntiga.reload()
      await expect(paginaAntiga).toHaveURL(loginQueVoltaPara('/dashboard/tutor'))
      await antiga.close()
    })

    await entrar(page, email, SENHA)
    await expect(page.getByText('Credenciais inválidas. Tente novamente.')).toBeVisible()
    await entrar(page, email, 'novaSenha456')
    await expect(page).toHaveURL('/')

    await test.step('abrir o mesmo link de novo não troca a senha', async () => {
      await sair(page)
      await redefinir(page, token, 'outra789x')
      await expect(page.getByText(/inválido|expirado/i)).toBeVisible()
      await entrar(page, email, 'outra789x')
      await expect(page.getByText('Credenciais inválidas. Tente novamente.')).toBeVisible()
    })
  })

  test('token inválido e senhas diferentes mostram erro', async ({ page }) => {
    await page.goto('/reset-password?token=token-que-nao-existe')
    await page.getByLabel('Nova Senha', { exact: true }).fill('abc12345')
    await page.getByLabel('Confirmar Nova Senha').fill('abc99999')
    await page.getByRole('button', { name: 'Redefinir Senha' }).click()
    await expect(page.getByText('As senhas não coincidem.')).toBeVisible()

    await page.getByLabel('Confirmar Nova Senha').fill('abc12345')
    await page.getByRole('button', { name: 'Redefinir Senha' }).click()
    await expect(page.getByText(/inválido|expirado/i)).toBeVisible()
  })
})
