import { test, expect, SENHA, CONTAS, SEM_SESSAO } from './fixtures'

test.use({ storageState: SEM_SESSAO })

async function entrar(page: import('@playwright/test').Page, perfil: 'admin' | 'tutor') {
  const response = await page.request.post('/api/auth/login', { data: { email: CONTAS[perfil].email, password: SENHA } })
  expect(response.ok()).toBeTruthy()
}

test('visitante não consulta métricas e é enviado ao login', async ({ page }) => {
  expect((await page.request.get('/api/admin/capacidade')).status()).toBe(401)
  await page.goto('/admin/uso')
  await expect(page).toHaveURL(/\/login\?next=/, { timeout: 45_000 })
})

test('tutor não acessa métricas de infraestrutura', async ({ page }) => {
  await entrar(page, 'tutor')
  expect((await page.request.get('/api/admin/capacidade')).status()).toBe(403)
  await page.goto('/admin/uso')
  await expect(page.getByText('Esta área é restrita ao administrador da Lince Pet.')).toBeVisible()
  await expect(page.getByRole('meter')).toHaveCount(0)
})

test('admin navega das aprovações ao uso real do banco e atualiza a leitura', async ({ page }, testInfo) => {
  await entrar(page, 'admin')
  await page.goto('/admin/aprovacoes')
  await page.getByRole('link', { name: 'Uso de dados', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Uso de dados', exact: true })).toBeVisible()
  await expect(page.getByRole('meter', { name: 'Banco de dados' })).toBeVisible()
  const response = await page.request.get('/api/admin/capacidade')
  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toContain('no-store')
  const result = await response.json()
  expect(result.banco.status).toBe('disponivel')
  expect(result.banco.uso.bytes).toBeGreaterThan(0)
  expect(result.banco.tabelas.length).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Atualizar leitura' }).click()
  await expect(page.getByRole('button', { name: 'Atualizar leitura' })).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('capacidade-admin.png'), fullPage: true })
})

const uso = (percentual: number, nivel: string) => ({ bytes: percentual * 5_000_000, limiteBytes: 500_000_000, percentual, nivel, livresBytes: Math.max(0, 500_000_000 - percentual * 5_000_000) })
for (const [percentual, nivel, mensagem] of [
  [70, 'atencao', 'Atenção: planeje a ampliação'],
  [90, 'critico', 'Crítico: priorize a ampliação'],
  [105, 'excedido', 'Referência de capacidade atingida'],
] as const) {
  test(`admin vê aviso de capacidade em ${percentual}%`, async ({ page }) => {
    await entrar(page, 'admin')
    await page.route('**/api/admin/capacidade', (route) => route.fulfill({ json: {
      consultadoEm: new Date().toISOString(), referencia: { bancoMb: 500, storageGb: 1 },
      banco: { status: 'disponivel', uso: uso(percentual, nivel), tabelas: [] },
      storage: { status: 'nao_configurado', uso: null, objetos: 0, semTamanho: 0, buckets: [] },
    } }))
    await page.goto('/admin/uso')
    await expect(page.getByText(mensagem, { exact: true })).toBeVisible()
    await expect(page.getByText(/Storage do Supabase não encontrado/)).toBeVisible()
  })
}

test('falha na consulta não apresenta armazenamento vazio', async ({ page }) => {
  await entrar(page, 'admin')
  await page.route('**/api/admin/capacidade', (route) => route.fulfill({ status: 503, json: { message: 'Indisponível' } }))
  await page.goto('/admin/uso')
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível atualizar o uso de dados' })).toBeVisible()
  await expect(page.getByRole('meter')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Atualizar leitura' })).toBeEnabled()
})
