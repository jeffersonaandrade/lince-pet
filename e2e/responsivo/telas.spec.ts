import { CONTAS, entrar, expect, sessao, test, type Perfil } from '../fixtures'
import { clicavel, semProblemasDeLayout, TELAS } from './layout'

const PAGINAS_PUBLICAS = [
  '/',
  '/login',
  '/forgot-password',
  '/signup',
  '/signup/tutor',
  '/signup/veterinario',
  '/signup/clinica',
  '/signup/prestador',
  '/explorar',
]

const PAINEIS: Perfil[] = ['tutor', 'veterinario', 'clinica', 'prestador']

for (const tela of TELAS) {
  test.describe(`responsivo: ${tela.nome} (${tela.width}x${tela.height})`, () => {
    test.use({ viewport: { width: tela.width, height: tela.height }, isMobile: tela.width < 768, hasTouch: true })

    for (const caminho of PAGINAS_PUBLICAS) {
      test(`${caminho} cabe na tela e os controles têm tamanho de toque`, async ({ page }) => {
        await page.goto(caminho)
        await page.waitForLoadState('networkidle')
        await semProblemasDeLayout(page)
      })
    }

    test('login: campos e botão Entrar alcançáveis e clicáveis', async ({ page }) => {
      await page.goto('/login')
      await clicavel(page.getByLabel('Email'))
      await clicavel(page.getByLabel('Senha', { exact: true }))
      await clicavel(page.getByRole('button', { name: 'Entrar' }))
      await clicavel(page.getByRole('link', { name: 'Esqueceu sua senha?' }))
      await entrar(page, CONTAS.tutor.email)
      await expect(page).toHaveURL('/')
    })

    test('busca: tocar no rótulo do campo foca o campo', async ({ page }) => {
      await page.goto('/explorar')
      await page.getByText('Busca', { exact: true }).click()
      await expect(page.getByRole('textbox', { name: 'Busca' })).toBeFocused()
    })

    test('explorar: as três abas são alcançáveis e trocam a lista', async ({ page }) => {
      await page.goto('/explorar')
      for (const aba of ['Clínicas', 'Profissionais pet', 'Veterinários']) {
        await clicavel(page.getByRole('button', { name: aba, exact: true }))
        await page.getByRole('button', { name: aba, exact: true }).click()
      }
    })

    if (tela.width < 768) {
      test('menu do celular abre, mostra as opções e fecha', async ({ page }) => {
        await page.goto('/')
        await page.getByRole('button', { name: 'Abrir menu' }).click()
        const menu = page.locator('aside')
        await expect(menu).toHaveAttribute('aria-hidden', 'false')
        for (const item of ['Explorar', 'Sobre', 'Contato', 'Entrar', 'Cadastrar']) {
          await clicavel(menu.getByRole('link', { name: item }))
        }
        await semProblemasDeLayout(page)
        await menu.getByRole('button', { name: 'Fechar menu' }).click()
        await expect(menu).toHaveAttribute('aria-hidden', 'true')
      })
    }

    for (const perfil of PAINEIS) {
      test.describe(`painel de ${perfil}`, () => {
        test.use({ storageState: sessao(perfil) })

        test('cabe na tela e os controles têm tamanho de toque', async ({ page }) => {
          await page.goto(CONTAS[perfil].dashboard)
          await page.waitForLoadState('networkidle')
          await expect(page).toHaveURL(new RegExp(`${CONTAS[perfil].dashboard}$`))
          await semProblemasDeLayout(page)
        })

        if (tela.width < 768) {
          test('Perfil e Sair alcançáveis pelo menu do celular', async ({ page }) => {
            await page.goto(CONTAS[perfil].dashboard)
            await page.getByRole('button', { name: 'Abrir menu' }).click()
            const menu = page.locator('aside')
            await clicavel(menu.getByRole('link', { name: 'Perfil' }))
            await clicavel(menu.getByRole('button', { name: 'Sair' }))
          })
        }
      })
    }
  })
}
