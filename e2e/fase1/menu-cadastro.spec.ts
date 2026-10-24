import { test, expect } from '@playwright/test'

for (const largura of [390, 768, 1440]) {
  test(`menu de cadastro: imagens e navegação por teclado em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 })
    await page.goto('/signup')

    await expect(page.getByRole('heading', { name: 'Clínica e laboratório' })).toBeVisible()
    await expect(page.getByText(/Exames exigem plano pago e responsável técnico aprovado/)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    for (const perfil of ['tutor', 'veterinario', 'clinica', 'prestador']) {
      const card = page.locator(`a[href="/signup/${perfil}"]`)
      await card.scrollIntoViewIfNeeded()
      await expect(card.getByRole('img')).toBeVisible()
      await expect.poll(() => card.getByRole('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
      await expect(card.locator('button, input, a')).toHaveCount(0)
      await card.focus()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(`/signup/${perfil}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.goto('/signup')
    }
  })
}
