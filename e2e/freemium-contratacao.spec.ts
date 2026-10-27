import { test, expect, type Page } from '@playwright/test'

// Testa o frontend real com APIs interceptadas; nunca cria cobrança no Asaas.
const gratuito = { code: 'free', name: 'Gratuito', priceCents: 0 }
const status = { plan: gratuito, usage: { used: 4, limit: 5 }, subscription: null, statusLabel: null, testeDisponivel: false, cancelamentoPendente: false, checkoutUrl: null, emTeste: false, trialEnd: null }

async function preparar(page: Page, tipo: 'veterinario' | 'prestador') {
  const envios: unknown[] = []
  await page.route('**/api/**', async route => {
    const req = route.request(); const path = new URL(req.url()).pathname
    if (path === '/api/auth/me') return route.fulfill({ json: { user: { id: 'teste-ui', nome: 'Teste', userType: tipo, onboardingComplete: 1 } } })
    if (path === '/api/assinaturas/status') return route.fulfill({ json: status })
    if (path === '/api/assinaturas/planos') return route.fulfill({ json: { plans: tipo === 'veterinario'
      ? [{ ...gratuito, id: 'f', trialDays: 0 }, { id: 's', code: 'vet_starter', name: 'Vet Starter', priceCents: 3990, trialDays: 0 }, { id: 'p', code: 'vet_pro', name: 'Vet Pro', priceCents: 5990, trialDays: 0 }]
      : [{ id: 'p', code: 'pro', name: 'Pro', priceCents: 5900, trialDays: 0 }] } })
    if (path === '/api/prestadores/perfil') return route.fulfill({ json: { data: { id: 'teste-p', tipo_servico: { nome: 'Passeador' }, onboarding_complete: true } } })
    if (path === '/api/assinaturas' && req.method() === 'POST') {
      envios.push(req.postDataJSON())
      return route.fulfill({ json: { subscription: { id: 'simulada' }, checkoutUrl: null, emTeste: false, primeiraFatura: '2026-10-27', message: 'Confirmação interceptada' } })
    }
    return route.fulfill({ json: { data: [] } })
  })
  return envios
}

test('veterinário vê valor, aceita condições e só então inicia contratação', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  const envios = await preparar(page, 'veterinario')
  await page.goto('/dashboard/veterinario/alterar-plano')
  await page.getByRole('button', { name: 'Assinar plano', exact: true }).last().click()
  const resumo = page.getByRole('region', { name: 'Resumo da contratação' })
  await expect(resumo).toContainText('59,90')
  await expect(page.locator('body')).not.toContainText('14 dias')
  await expect(resumo).toContainText('forma de pagamento na fatura do Asaas')
  const confirmar = page.getByRole('button', { name: /Confirmar Vet Pro/ })
  await expect(confirmar).toBeDisabled()
  expect(envios).toHaveLength(0)
  await resumo.getByRole('checkbox').check()
  expect(envios).toHaveLength(0)
  await confirmar.click()
  await expect(page.getByText('Confirmação interceptada')).toBeVisible()
  expect(envios).toEqual([{ planCode: 'vet_pro', valorConfirmadoCentavos: 5990, aceite: true }])
})

test('prestador precisa abrir o resumo e aceitar o preço antes de assinar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  const envios = await preparar(page, 'prestador')
  await page.goto('/dashboard/prestador')
  await expect(page.getByText('4 de 5 aceites neste mês')).toBeVisible()
  await page.getByRole('button', { name: 'Ver e contratar Pro' }).click()
  const resumo = page.getByRole('region', { name: 'Resumo da contratação' })
  await expect(resumo).toContainText('59,00')
  await expect(resumo).not.toContainText('14 dias')
  const confirmar = page.getByRole('button', { name: /Confirmar Pro/ })
  await expect(confirmar).toBeDisabled()
  expect(envios).toHaveLength(0)
  await resumo.getByRole('checkbox').check()
  expect(envios).toHaveLength(0)
  await confirmar.click()
  await expect(page.getByRole('button', { name: 'Ver e contratar Pro' })).toBeVisible()
  expect(envios).toEqual([{ planCode: 'pro', valorConfirmadoCentavos: 5900, aceite: true }])
})
