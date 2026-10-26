import { test, expect, CONTAS, SENHA, SEM_SESSAO } from './fixtures'
import { consultar } from './db'

test.use({ storageState: SEM_SESSAO })
const endpoint = '/api/admin/especialidades'
type Item = { id: string; nome: string; descricao: string | null; ativo: boolean; revisao: string; vinculos: number }

test('visitante e tutor não acessam nem alteram o catálogo administrativo', async ({ page }) => {
  for (const status of [401, 403]) {
    if (status === 403) {
      expect((await page.request.post('/api/auth/login', { data: { email: CONTAS.tutor.email, password: SENHA } })).ok()).toBeTruthy()
    }
    expect((await page.request.get(endpoint)).status()).toBe(status)
    expect((await page.request.post(endpoint, { data: {} })).status()).toBe(status)
    expect((await page.request.put(`${endpoint}/ausente`, { data: {} })).status()).toBe(status)
    expect((await page.request.delete(`${endpoint}/ausente`, { data: {} })).status()).toBe(status)
    await page.goto('/admin/especialidades')
    if (status === 401) await expect(page).toHaveURL(/\/login\?next=/)
    else await expect(page.getByText('Esta área é restrita ao administrador da Lince Pet.')).toBeVisible()
  }
})

test('admin cria, edita, inativa e reativa pela interface em desktop e celular', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  expect((await page.request.post('/api/auth/login', { data: { email: CONTAS.admin.email, password: SENHA } })).ok()).toBeTruthy()
  const nome = `E2E Especialidade ${Date.now()}`
  const editado = `${nome} revisada`
  let id = ''
  try {
    await page.goto('/admin/aprovacoes')
    await page.getByRole('link', { name: 'Especialidades', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Especialidades', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Nova especialidade', exact: true }).click()
    await page.getByLabel('Nome', { exact: true }).fill(nome)
    await page.getByLabel('Descrição (opcional)').fill('Área de atuação para teste do cadastro.')
    const [criada] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith(endpoint) && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Salvar especialidade' }).click(),
    ])
    expect(criada.status()).toBe(201)
    await expect(page.getByRole('status')).toHaveText('Especialidade salva.')
    const itens: Item[] = await (await page.request.get(endpoint)).json()
    id = itens.find(e => e.nome === nome)!.id
    expect((await (await page.request.get('/api/especialidades')).json()).data).toEqual(expect.arrayContaining([expect.objectContaining({ id, nome })]))
    await page.getByLabel('Buscar especialidade').fill(nome)
    await page.getByRole('button', { name: `Editar ${nome}`, exact: true }).click()
    await page.getByLabel('Nome', { exact: true }).fill(editado)
    const [salva] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith(`${endpoint}/${id}`) && r.request().method() === 'PUT'),
      page.getByRole('button', { name: 'Salvar especialidade' }).click(),
    ])
    expect(salva.status()).toBe(200)
    await expect(page.getByRole('status')).toHaveText('Especialidade salva.')
    await page.screenshot({ path: testInfo.outputPath('especialidades-desktop.png'), fullPage: true })
    page.once('dialog', d => d.accept())
    await page.getByRole('button', { name: `Inativar ${editado}`, exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Especialidade inativada.')
    expect((await (await page.request.get('/api/especialidades')).json()).data.some((e: Item) => e.id === id)).toBe(false)
    await page.getByLabel('Status', { exact: true }).selectOption('inativas')
    await expect(page.getByRole('listitem', { name: editado, exact: true })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: testInfo.outputPath('especialidades-mobile.png'), fullPage: true })
    const overflow = await page.getByRole('region', { name: 'Especialidades', exact: true }).evaluate(el => el.scrollWidth > el.clientWidth)
    expect(overflow).toBe(false)
    await page.getByRole('button', { name: `Reativar ${editado}`, exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Especialidade reativada.')
    await page.getByLabel('Status', { exact: true }).selectOption('ativas')
    await expect(page.getByRole('listitem', { name: editado, exact: true })).toBeVisible()
  } finally {
    // Exclusão de fixture somente no banco local autorizado pelo global-setup.
    if (id) await consultar('delete from especialidades where id = $1', [id])
    else await consultar('delete from especialidades where nome = $1', [nome])
  }
})

test('duplicatas concorrentes e revisões antigas não sobrescrevem o catálogo', async ({ page }) => {
  await page.request.post('/api/auth/login', { data: { email: CONTAS.admin.email, password: SENHA } })
  const nome = `E2E Concorrencia ${Date.now()}`
  let id = ''
  try {
    const respostas = await Promise.all([
      page.request.post(endpoint, { data: { nome, ativo: true } }),
      page.request.post(endpoint, { data: { nome: nome.toUpperCase().replaceAll(' ', '  '), ativo: true } }),
    ])
    expect(respostas.map(r => r.status()).sort()).toEqual([201, 409])
    const item: Item = (await (await page.request.get(endpoint)).json()).find((e: Item) => e.nome.toLowerCase() === nome.toLowerCase())
    id = item.id
    expect((await page.request.put(`${endpoint}/${id}`, { data: { ...item, descricao: 'Atualizada' } })).status()).toBe(200)
    expect((await page.request.put(`${endpoint}/${id}`, { data: { ...item, nome: `${nome} antiga` } })).status()).toBe(409)
    expect((await page.request.delete(`${endpoint}/${id}`, { data: { revisao: item.revisao } })).status()).toBe(409)
    expect((await page.request.post(endpoint, { data: { nome: ' ', ativo: true } })).status()).toBe(422)
  } finally {
    if (id) await consultar('delete from especialidades where id = $1', [id])
    else await consultar('delete from especialidades where lower(nome) = lower($1)', [nome])
  }
})

test('inativação mantém vínculos e recusa novas associações no perfil do veterinário', async ({ page }) => {
  await page.request.post('/api/auth/login', { data: { email: CONTAS.admin.email, password: SENHA } })
  const nome = `E2E Vinculo ${Date.now()}`
  const criada = await page.request.post(endpoint, { data: { nome, ativo: true } })
  expect(criada.status()).toBe(201)
  const { id } = await criada.json()
  const [vet] = await consultar<{ id: string }>('select v.id from veterinarios v join users u on u.id = v.user_id where u.email = $1', [CONTAS.veterinario.email])
  try {
    await consultar("insert into especialidade_relacionamentos (entidade_id, especialidade_id, entidade_tipo) values ($1, $2, 'veterinario')", [vet.id, id])
    const item: Item = (await (await page.request.get(endpoint)).json()).find((e: Item) => e.id === id)
    expect(item.vinculos).toBe(1)
    expect((await page.request.delete(`${endpoint}/${id}`, { data: { revisao: item.revisao } })).status()).toBe(200)
    expect(await consultar('select especialidade_id from especialidade_relacionamentos where especialidade_id = $1', [id])).toHaveLength(1)
    await page.request.post('/api/auth/login', { data: { email: CONTAS.veterinario2.email, password: SENHA } })
    expect((await page.request.put('/api/veterinarios/profile', { data: { especialidades: [id] } })).status()).toBe(422)
  } finally {
    await consultar('delete from especialidade_relacionamentos where especialidade_id = $1', [id])
    await consultar('delete from especialidades where id = $1', [id])
  }
})
