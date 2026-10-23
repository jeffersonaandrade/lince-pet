import { abrirMenuDaConta, cadastrarTutorPelaTela, CONTAS, entrar, expect, loginQueVoltaPara, SEM_SESSAO, sessao, test } from '../fixtures'

const PAINEIS = ['/dashboard/tutor', '/dashboard/veterinario', '/dashboard/clinica', '/dashboard/prestador']
const TELAS_PRIVADAS = [...PAINEIS, ...PAINEIS.map((p) => `${p}/perfil`)]

test.describe('sem login', () => {
  test.use({ storageState: SEM_SESSAO })

  for (const tela of TELAS_PRIVADAS) {
    test(`${tela} manda para o login e não carrega dado privado`, async ({ page }) => {
      const privadas: string[] = []
      page.on('response', (r) => {
        const rota = new URL(r.url()).pathname
        if (rota.startsWith('/api/') && rota !== '/api/auth/me' && r.status() === 200 && /pets|agendamentos|notifications|perfil|profile/.test(rota)) {
          privadas.push(rota)
        }
      })
      await page.goto(tela)
      await expect(page).toHaveURL(loginQueVoltaPara(tela))
      await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
      expect(privadas, 'nenhuma rota privada respondeu 200 para o visitante').toEqual([])
    })
  }
})

test.describe('perfil cruzado', () => {
  test.describe('tutor', () => {
    test.use({ storageState: sessao('tutor') })

    for (const painel of ['/dashboard/veterinario', '/dashboard/clinica', '/dashboard/prestador']) {
      test(`digitando ${painel} na barra volta para a home`, async ({ page }) => {
        await page.goto(painel)
        await expect(page).toHaveURL('/')
        await abrirMenuDaConta(page)
        await expect(page.getByRole('banner').getByText(CONTAS.tutor.email).first()).toBeVisible()
      })
    }

    test('o menu da conta leva ao painel do tutor, não ao de outro tipo', async ({ page }) => {
      await page.goto('/')
      await abrirMenuDaConta(page)
      await page.getByRole('button', { name: 'Perfil' }).click()
      await expect(page).toHaveURL(/\/dashboard\/tutor$/)
      // Tentativa de invasão que a tela não oferece: chamar direto a API de outro tipo.
      for (const rota of ['/api/clinicas/professionals/search?q=a', '/api/encaminhamentos/recebidos', '/api/prestadores/pedidos']) {
        expect((await page.request.get(rota)).status(), rota).toBe(403)
      }
    })
  })

  test.describe('veterinário', () => {
    test.use({ storageState: sessao('veterinario') })

    test('digitando /dashboard/tutor volta para a home; o menu leva ao painel do vet', async ({ page }) => {
      await page.goto('/dashboard/tutor')
      await expect(page).toHaveURL('/')
      await abrirMenuDaConta(page)
      await page.getByRole('button', { name: 'Perfil' }).click()
      await expect(page).toHaveURL(/\/dashboard\/veterinario$/)
      for (const rota of ['/api/pets', '/api/favorites', '/api/tutor/encaminhamentos']) {
        expect((await page.request.get(rota)).status(), rota).toBe(403)
      }
    })
  })
})

test.describe('logout', () => {
  test.use({ storageState: SEM_SESSAO })

  test('sair pela tela encerra a sessão: o cookie antigo, reaproveitado em outra janela, não abre o painel', async ({ page, browser }) => {
    const email = await cadastrarTutorPelaTela(page)
    await page.goto('/')
    await abrirMenuDaConta(page)
    await expect(page.getByRole('banner').getByText(email).first()).toBeVisible()
    const cookiesAntes = await page.context().storageState()

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    await page.goto(CONTAS.tutor.dashboard)
    await expect(page).toHaveURL(loginQueVoltaPara(CONTAS.tutor.dashboard))

    const copia = await browser.newContext({ storageState: cookiesAntes })
    const outra = await copia.newPage()
    await outra.goto(CONTAS.tutor.dashboard)
    await expect(outra, 'token roubado antes do logout não vale mais').toHaveURL(loginQueVoltaPara(CONTAS.tutor.dashboard))
    await copia.close()

    await entrar(page, email)
    await expect(page).toHaveURL('/')
  })
})
