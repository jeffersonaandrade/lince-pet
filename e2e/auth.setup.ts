import { CONTAS, entrar, expect, sessao, test, type Perfil } from './fixtures'

for (const perfil of Object.keys(CONTAS) as Perfil[]) {
  test(`sessão de ${perfil}`, async ({ page }) => {
    await entrar(page, CONTAS[perfil].email)
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: 'Entrar' })).toHaveCount(0)
    await page.context().storageState({ path: sessao(perfil) })
  })
}
