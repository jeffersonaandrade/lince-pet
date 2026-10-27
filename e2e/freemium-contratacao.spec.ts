import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'

const capturas = process.env.CAPTURAS_CADASTRO_DIR

async function capturar(page: Page, nome: string) {
  if (!capturas) return
  await page.evaluate(() => window.scrollTo(0, 0))
  const altura = await page.locator('main').first().evaluate(el => Math.ceil(el.getBoundingClientRect().bottom + window.scrollY))
  await page.screenshot({ path: path.join(capturas, nome), fullPage: true, clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: altura }, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' })
}

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
      ? [{ ...gratuito, id: 'f', trialDays: 0 }, { id: 'p', code: 'vet_pro', name: 'Vet Pro', priceCents: 5990, trialDays: 0 }]
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
  await expect(page.locator('body')).not.toContainText('Vet Starter')
  await expect(page.locator('body')).not.toContainText('Financeiro')
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

async function prepararCadastro(page: Page, tipo: 'veterinario' | 'prestador', falhaCatalogo = false, falhaCobranca = false) {
  const cadastros: unknown[] = []; const cobrancas: unknown[] = []
  let logado = false
  const user = { id: 'teste-cadastro', nome: 'Teste', userType: tipo, onboardingComplete: 0 }
  await page.route('**/api/**', async route => {
    const req = route.request(); const path = new URL(req.url()).pathname
    if (path === '/api/auth/me') return route.fulfill(logado ? { json: { user } } : { status: 401, json: {} })
    if (path === '/api/auth/login') { logado = true; return route.fulfill({ json: { user } }) }
    if (path === '/api/assinaturas/planos') return route.fulfill(falhaCatalogo ? { status: 500, json: {} } : { json: { plans: [
      { ...gratuito, id: 'f', trialDays: 0 },
      { id: 'p', code: tipo === 'veterinario' ? 'vet_pro' : 'pro', name: tipo === 'veterinario' ? 'Vet Pro' : 'Pro', priceCents: tipo === 'veterinario' ? 5990 : 5900, trialDays: 0 },
    ] } })
    if (path === '/api/tipos-servico') return route.fulfill({ json: { data: [{ slug: 'passeador', nome: 'Passeador', modalidade: 'duracao' }] } })
    if (path === '/api/veterinarios' || path === '/api/prestadores/register') {
      cadastros.push(req.postDataJSON()); return route.fulfill({ json: { user } })
    }
    if (path === '/api/assinaturas' && req.method() === 'POST') {
      cobrancas.push(req.postDataJSON())
      return route.fulfill(falhaCobranca ? { status: 400, json: { message: 'Falha simulada no pagamento' } } : { json: { subscription: { id: 'simulada' }, checkoutUrl: null, emTeste: false, primeiraFatura: '2026-10-27', message: 'Cobrança simulada pendente' } })
    }
    if (path === '/api/prestadores/perfil') return route.fulfill({ json: { data: { onboarding_step: 1 } } })
    return route.fulfill({ json: { data: [], success: true } })
  })
  return { cadastros, cobrancas }
}

async function preencherCadastro(page: Page, tipo: 'veterinario' | 'prestador') {
  await page.goto(`/signup/${tipo}`)
  await page.getByLabel('Nome', { exact: true }).fill('Teste')
  await page.getByLabel('Sobrenome', { exact: true }).fill('Cadastro')
  if (tipo === 'veterinario') {
    await page.getByLabel('Número de Celular').fill('11999999999')
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await page.getByLabel('Email', { exact: true }).fill('teste@example.com')
  } else {
    await page.getByRole('button', { name: /Passeador/ }).click()
    await page.getByLabel('Celular (WhatsApp)').fill('11999999999')
    await page.getByLabel('E-mail', { exact: true }).fill('teste@example.com')
  }
  await page.getByLabel(/^Senha/).fill('senha123')
}

for (const tipo of ['veterinario', 'prestador'] as const) {
  test(`cadastro ${tipo}: comparar planos e confirmar Pro sem cobrança ao selecionar`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 })
    const { cadastros, cobrancas } = await prepararCadastro(page, tipo)
    await preencherCadastro(page, tipo)
    const gratis = page.getByRole('radio', { name: 'Gratuito', exact: true })
    await expect(gratis).toBeChecked()
    const pro = page.getByRole('radio', { name: tipo === 'veterinario' ? 'Vet Pro' : 'Pro', exact: true })
    await pro.check()
    await expect(page.getByRole('listitem').filter({ hasText: 'Agendamentos ilimitados' })).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Vet Starter')
    await expect(page.locator('body')).not.toContainText('Financeiro')
    const semOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    expect(await semOverflow()).toBe(true)
    await capturar(page, `${tipo}-mobile.png`)
    await page.setViewportSize({ width: 1440, height: 1000 })
    expect(await semOverflow()).toBe(true)
    await capturar(page, `${tipo}-desktop.png`)
    expect(cobrancas).toHaveLength(0)
    await page.getByLabel(tipo === 'veterinario' ? 'CPF' : 'CPF ou CNPJ (necessário para assinar)', { exact: true }).fill('52998224725')
    await page.getByRole('button', { name: 'Criar conta e revisar Pro' }).click()
    const resumo = page.getByRole('region', { name: 'Resumo da contratação' })
    await expect(resumo).toBeVisible()
    const confirmar = page.getByRole('button', { name: /Confirmar .*Pro/ })
    await expect(confirmar).toBeDisabled()
    expect(cadastros).toHaveLength(1)
    expect(cobrancas).toHaveLength(0)
    await resumo.getByRole('checkbox').check()
    await page.setViewportSize({ width: 390, height: 900 })
    expect(await semOverflow()).toBe(true)
    await capturar(page, `${tipo}-confirmacao-mobile.png`)
    await confirmar.click()
    await expect(page.getByRole('status')).toContainText('Cobrança simulada pendente')
    expect(cobrancas).toEqual([{ planCode: tipo === 'veterinario' ? 'vet_pro' : 'pro', valorConfirmadoCentavos: tipo === 'veterinario' ? 5990 : 5900, aceite: true }])
    await page.getByRole('button', { name: 'Continuar para montar perfil' }).click()
    await expect(page).toHaveURL(tipo === 'veterinario' ? /\/onboarding$/ : /\/onboarding\/prestador$/)
  })

  test(`cadastro ${tipo}: Gratuito segue sem gerar assinatura`, async ({ page }) => {
    const { cadastros, cobrancas } = await prepararCadastro(page, tipo)
    await preencherCadastro(page, tipo)
    await page.getByRole('button', { name: 'Criar conta gratuita' }).click()
    await expect(page).toHaveURL(tipo === 'veterinario' ? /\/onboarding$/ : /\/onboarding\/prestador$/)
    expect(cadastros).toHaveLength(1)
    expect(cobrancas).toHaveLength(0)
  })
}

test('cadastro bloqueia envio quando catálogo falha, com opção de tentar novamente', async ({ page }) => {
  const { cadastros, cobrancas } = await prepararCadastro(page, 'prestador', true)
  await preencherCadastro(page, 'prestador')
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível carregar os planos' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Criar conta gratuita' })).toBeDisabled()
  expect(cadastros).toHaveLength(0)
  expect(cobrancas).toHaveLength(0)
})

test('falha de cobrança mantém conta criada e permite seguir no Gratuito', async ({ page }) => {
  const { cadastros, cobrancas } = await prepararCadastro(page, 'prestador', false, true)
  await preencherCadastro(page, 'prestador')
  await page.getByRole('radio', { name: 'Pro', exact: true }).check()
  await page.getByLabel('CPF ou CNPJ (necessário para assinar)').fill('52998224725')
  await page.getByRole('button', { name: 'Criar conta e revisar Pro' }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /Confirmar Pro/ }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Falha simulada no pagamento' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar no Gratuito e montar perfil' }).click()
  await expect(page).toHaveURL(/\/onboarding\/prestador$/)
  expect(cadastros).toHaveLength(1)
  expect(cobrancas).toHaveLength(1)
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
