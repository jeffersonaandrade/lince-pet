import { test, expect, type Page } from '@playwright/test'

// Respostas controladas: nenhum cadastro, envio ou agendamento real é alterado.
async function preparar(page: Page, papel: string, telefone: string | null = '(81) 99999-1234', permitido = true, statusConsulta = 'realizado') {
  await page.route('**/api/**', route => {
    const p = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') throw new Error(`Mutação inesperada: ${p}`)
    let json: unknown = { data: [], agendamentos: [], profissionais: [], notificacoes: [], veterinario: { planos: [] }, clinica: {} }
    if (p === '/api/auth/me') json = { user: { id: 'teste', nome: 'Equipe de teste', userType: papel, onboardingComplete: 1 } }
    if (p.includes('/onboarding/progress')) json = { currentStep: 8, veterinario: { id: 'teste', planos: [] } }
    if (p === '/api/prestadores/perfil') json = { data: { id: 'teste', onboarding_complete: true, tipo_servico: { nome: 'Profissional pet' } } }
    if (p === '/api/prestadores/pedidos') json = { data: [{ id: 'pedido', status: 'confirmado', inicio_em: '2026-10-28T17:30:00Z', fim_em: '2026-10-28T18:00:00Z', preco: 50, local_nome: 'Espaço de teste', local_endereco: 'Rua de teste', tutor: { nome: 'João & Maria', celular: telefone, whatsapp_permitido: permitido }, servico: { nome: 'Atendimento' }, pet: { nome: 'Pet de teste' } }] }
    if (p === '/api/clinicas/exames') json = { plano_com_exames: false }
    if (p === '/api/clinicas/exames/agenda') json = { agendamentos: [{ id: 'exame', status: 'realizado', inicio_em: '2026-10-28T02:30:00Z', preco: 50, exames: [{ nome: 'Exame de teste' }], clinica: { nome: 'Clínica de teste' }, tutor: { nome: 'João & Maria', celular: telefone, whatsapp_permitido: permitido }, pet: { nome: 'Pet de teste' }, laudo: { nome_arquivo: 'resultado.pdf' } }] }
    if (p.endsWith('/agendamentos')) json = { agendamentos: [{ id: 123, data_consulta: papel === 'clinica' ? '2026-10-28' : '28/10/2026', horario_consulta: '14:30', status: statusConsulta, tutor_nome: 'João & Maria', tutor_telefone: telefone, tutor_whatsapp_permitido: permitido, pet_nome: 'Pet de teste', local_nome: 'Clínica de teste', tipo_consulta: 'presencial' }] }
    if (p.includes('/estatisticas')) json = { agendamentosHoje: 1, agendamentosSemana: 1, agendamentosMes: 1, totalClientes: 1 }
    return route.fulfill({ json })
  })
}

const botao = (page: Page) => page.getByRole('link', { name: 'Avisar tutor pelo WhatsApp' })
async function conferir(page: Page) {
  await expect(botao(page)).toBeVisible()
  const url = new URL((await botao(page).getAttribute('href'))!)
  expect(url.hostname).toBe('wa.me')
  expect(url.pathname).toBe('/5581999991234')
  expect(url.searchParams.get('text')).toContain('João & Maria')
  await expect(page.getByText(/Envio manual pela conta conectada/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  // Bloqueia a saída externa; comprova o clique sem abrir conta ou enviar mensagem.
  await page.context().route('https://wa.me/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Conversa de teste</p>' }))
  const popupPromise = page.waitForEvent('popup')
  await botao(page).click()
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded')
  expect(popup.url()).toContain('https://wa.me/5581999991234?text=')
  await popup.close()
  return url.searchParams.get('text')!
}

test.use({ viewport: { width: 390, height: 844 } })

test('prestador abre conversa com o telefone do portal e o horário de Brasília', async ({ page }) => {
  await preparar(page, 'prestador')
  await page.goto('/dashboard/prestador')
  await page.getByRole('tab', { name: /Agenda/ }).click()
  const mensagem = await conferir(page)
  expect(mensagem).toContain('28/10/2026 às 14:30')
  await page.screenshot({ path: 'test-results/whatsapp-manual-prestador-mobile.png', fullPage: true })
})

test('exame usa Brasília na virada do dia e direciona resultado para o site', async ({ page }) => {
  await preparar(page, 'clinica')
  await page.goto('/dashboard/clinica/exames')
  const mensagem = await conferir(page)
  expect(mensagem).toContain('27/10/2026 às 23:30')
  expect(mensagem).toContain('O resultado está disponível')
  expect(mensagem).not.toContain('resultado.pdf')
  expect(mensagem).not.toContain('Exame de teste')
  await page.screenshot({ path: 'test-results/whatsapp-manual-exames-mobile.png', fullPage: true })
})

for (const papel of ['veterinario', 'clinica']) {
  test(`${papel}: botão disponível nos detalhes da consulta`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-28T15:00:00Z'))
    await preparar(page, papel)
    await page.goto(`/dashboard/${papel}`)
    await page.getByRole('article').filter({ hasText: 'Pet de teste' }).first().click()
    const mensagem = await conferir(page)
    expect(mensagem).toContain('28/10/2026 às 14:30')
    expect(mensagem).toContain('Clínica de teste')
    await page.screenshot({ path: `test-results/whatsapp-manual-${papel}-mobile.png`, fullPage: true })
  })
}

test('sem telefone cadastrado não oferece envio', async ({ page }) => {
  await preparar(page, 'clinica', null)
  await page.goto('/dashboard/clinica/exames')
  await expect(page.getByText(/tutor sem telefone válido/)).toBeVisible()
  await expect(botao(page)).toHaveCount(0)
})

test('opt-out do tutor impede o atalho', async ({ page }) => {
  await preparar(page, 'clinica', '81999991234', false)
  await page.goto('/dashboard/clinica/exames')
  await expect(page.getByText('O tutor desativou os avisos por WhatsApp.')).toBeVisible()
  await expect(botao(page)).toHaveCount(0)
})

for (const papel of ['veterinario', 'clinica']) {
  test(`${papel}: modal cabe na área visível do Safari com barras e teclado`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperties(window.visualViewport!, {
        height: { configurable: true, value: 600 },
        offsetTop: { configurable: true, value: 64 },
      })
    })
    await page.clock.setFixedTime(new Date('2026-10-28T15:00:00Z'))
    await preparar(page, papel, '81999991234', true, 'pendente')
    await page.goto(`/dashboard/${papel}`)
    await page.getByRole('article').filter({ hasText: 'Pet de teste' }).first().click()
    const dialog = page.getByRole('dialog')
    const mensagem = new URL((await botao(page).getAttribute('href'))!).searchParams.get('text')!
    expect(mensagem).not.toMatch(/aguardando confirmação|situação: pendente/i)
    const titulo = dialog.getByRole('heading').first()
    const fechar = dialog.getByRole('button', { name: 'Fechar', exact: true }).first()
    const rodape = dialog.getByRole('button', { name: papel === 'veterinario' ? 'Voltar' : 'Fechar', exact: true }).last()
    async function conferirArea(top: number, height: number) {
      await expect.poll(async () => (await titulo.boundingBox())!.y).toBeGreaterThanOrEqual(top)
      for (const elemento of [titulo, fechar, rodape]) {
        const box = (await elemento.boundingBox())!
        expect(box.y).toBeGreaterThanOrEqual(top)
        expect(box.y + box.height).toBeLessThanOrEqual(top + height)
      }
      await expect(botao(page)).toBeVisible()
    }
    await conferirArea(64, 600)
    await expect(page.locator('body')).toHaveCSS('position', 'fixed')
    await page.evaluate(() => {
      Object.defineProperties(window.visualViewport!, { height: { configurable: true, value: 450 }, offsetTop: { configurable: true, value: 100 } })
      window.visualViewport!.dispatchEvent(new Event('resize'))
    })
    await conferirArea(100, 450)
    await dialog.locator('[class*="modalBody"]').evaluate(el => { el.scrollTop = el.scrollHeight })
    await expect(titulo).toBeVisible()
    await expect(rodape).toBeVisible()
    await fechar.click()
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('body')).not.toHaveCSS('position', 'fixed')
  })
}
