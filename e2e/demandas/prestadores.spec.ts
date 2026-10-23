import { randomUUID } from 'node:crypto'
import type { Browser, Page } from '@playwright/test'
import { expect, SEM_SESSAO, sessao, test, type Perfil } from '../fixtures'
import { agendamento, idPrestador } from '../agenda'
import { consultar } from '../db'
import { cadastrarPetPelaTela, cancelarPelaTela, cartaoDoPet, dataBR, hojeNoNavegador, somarDias } from '../telas'

type Prestador = Awaited<ReturnType<typeof idPrestador>>

async function servicoDe(prestadorId: string) {
  const [s] = await consultar<{ id: string; nome: string }>(
    `select id, nome from servicos_oferecidos where prestador_id = $1 and ativo = 1 order by nome limit 1`,
    [prestadorId]
  )
  return s
}

async function janela(browser: Browser, perfil: Perfil) {
  const ctx = await browser.newContext({ storageState: sessao(perfil) })
  return { ctx, page: await ctx.newPage() }
}

const horariosDoForm = (page: Page) => page.getByRole('group', { name: 'Horários disponíveis' }).getByRole('button')

/** Perfil público do prestador: escolhe o serviço e a data; devolve os horários oferecidos. */
async function abrirPedido(page: Page, p: Prestador, servico: string, data: string) {
  if (!page.url().includes(`/profissionais/${p.id}`)) await page.goto(`/profissionais/${p.id}`)
  await page.getByRole('radio', { name: new RegExp(servico) }).check()
  const resposta = page
    .waitForResponse((r) => r.url().includes(`/prestadores/${p.id}/disponibilidade`) && r.url().includes(`data=${data}`), { timeout: 10_000 })
    .catch(() => null)
  await page.getByLabel('Data', { exact: true }).fill(data)
  await resposta
  return horariosDoForm(page).allInnerTexts()
}

/** Primeiro dia (a partir de daqui a 3 dias) com ao menos 2 horários livres, procurado pelo formulário. */
async function diaComHorarios(page: Page, p: Prestador, servico: string) {
  let data = somarDias(await hojeNoNavegador(page), 3 + Math.floor(Math.random() * 20))
  for (let i = 0; i < 21; i++, data = somarDias(data, 1)) {
    const horarios = await abrirPedido(page, p, servico, data)
    if (horarios.length >= 2) return { data, horarios }
  }
  throw new Error('Prestador sem horários livres nas próximas semanas')
}

async function pedirPelaTela(page: Page, pet: string, hora: string) {
  const petSelect = page.getByRole('combobox').filter({ has: page.locator('option', { hasText: pet }) })
  const valor = await petSelect.locator('option').filter({ hasText: pet }).getAttribute('value')
  await petSelect.selectOption(valor!)
  await horariosDoForm(page).filter({ hasText: hora }).click()
  await page.getByRole('button', { name: 'Pedir serviço' }).click()
  await expect(page.getByText('Pedido enviado!')).toBeVisible()
  const [pedido] = await consultar<{ id: string }>(
    `select a.id from agendamentos a join pets p on p.id = a.pet_id where p.nome = $1 and a.status = 'pendente' order by a.created_at desc limit 1`,
    [pet]
  )
  return pedido.id
}

const painelPedidos = (page: Page) => page.locator('section').filter({ has: page.getByRole('tablist') })
const pedidoNoPainel = (page: Page, pet: string) => painelPedidos(page).getByRole('listitem').filter({ hasText: pet })

test.describe('profissionais pet pela tela', () => {
  test.use({ storageState: sessao('tutor') })

  test('pedido: aceitar, remarcar volta a pendente, recusar com motivo; horário pedido some para os outros', async ({ page, browser }) => {
    test.setTimeout(5 * 60_000)
    const bianca = await idPrestador()
    const servico = await servicoDe(bianca.id)
    const pet = await cadastrarPetPelaTela(page, `Floquinho ${Date.now().toString().slice(-6)}`)
    const [{ celular: celularTutor }] = await consultar<{ celular: string }>(`select celular from users where email = 'joao.silva.mockup@email.com'`)

    const { data, horarios } = await diaComHorarios(page, bianca, servico.nome)
    const [h0, h1] = horarios
    const pedidoId = await pedirPelaTela(page, pet, h0)
    expect(await agendamento(pedidoId)).toMatchObject({ status: 'pendente' })

    await test.step('outro tutor não vê mais o horário pedido', async () => {
      const tutor2 = await janela(browser, 'tutor2')
      expect(await abrirPedido(tutor2.page, bianca, servico.nome, data)).not.toContain(h0)
      await test.step('invasão (fora da tela): pedir com pet de outro tutor', async () => {
        const [{ id: petAlheio }] = await consultar<{ id: string }>(`select id from pets where nome = $1`, [pet])
        const res = await tutor2.page.request.post(`/api/prestadores/${bianca.id}/pedidos`, {
          data: { pet_id: petAlheio, servico_id: servico.id, data, horario: h1, local: bianca.atende_domicilio ? 'domicilio' : 'local_proprio' },
        })
        expect(res.status()).toBe(404)
      })
      await tutor2.ctx.close()
    })

    const prestador = await janela(browser, 'prestador')
    await test.step('prestador vê o pedido sem o celular do tutor e aceita', async () => {
      await prestador.page.goto('/dashboard/prestador')
      const item = pedidoNoPainel(prestador.page, pet)
      await expect(item).toContainText(servico.nome)
      if (celularTutor) await expect(item).not.toContainText(celularTutor)
      await item.getByRole('button', { name: 'Aceitar' }).click()
      await expect(item).toHaveCount(0)
      await painelPedidos(prestador.page).getByRole('tab', { name: /^Agenda/ }).click()
      await expect(pedidoNoPainel(prestador.page, pet).getByLabel('Código de início informado pelo tutor')).toBeVisible()
      await expect.poll(async () => (await agendamento(pedidoId)).status).toBe('confirmado')
    })

    await test.step('tutor vê o código de início e remarca: volta a pendente', async () => {
      await page.goto('/dashboard/tutor')
      const cartao = cartaoDoPet(page, pet)
      await expect(cartao.locator('.font-mono')).toHaveText(/^\d{6}$/)
      await cartao.getByRole('button', { name: 'Reagendar' }).click()
      const modal = page.getByRole('dialog').filter({ hasText: 'Remarcar pedido' })
      await modal.getByLabel('Data').fill(data)
      // O modal não desconta o próprio pedido: horários que se sobrepõem a ele não aparecem.
      const novoHorario = modal.getByRole('button', { name: /^\d{2}:\d{2}$/ }).last()
      const hNovo = (await novoHorario.innerText()).trim()
      expect(hNovo).not.toBe(h0)
      await novoHorario.click()
      await modal.getByRole('button', { name: 'Remarcar' }).click()
      await expect(modal).toBeHidden()
      await expect.poll(async () => (await agendamento(pedidoId)).status).toBe('pendente')
      expect((await agendamento(pedidoId)).horario_consulta).toBe(hNovo)
      await expect(cartaoDoPet(page, pet)).toContainText('Aguardando o profissional aceitar o pedido.')
    })

    await test.step('prestador recusa com motivo e o pedido vai para o histórico', async () => {
      await prestador.page.goto('/dashboard/prestador')
      prestador.page.once('dialog', (d) => d.accept('Agenda cheia'))
      await pedidoNoPainel(prestador.page, pet).getByRole('button', { name: 'Recusar' }).click()
      await expect.poll(async () => (await agendamento(pedidoId)).status).toBe('cancelado')
      expect((await agendamento(pedidoId)).motivo_cancelamento).toBe('Recusado pelo profissional: Agenda cheia')
      await painelPedidos(prestador.page).getByRole('tab', { name: /^Histórico/ }).click()
      await expect(pedidoNoPainel(prestador.page, pet)).toContainText('Motivo: Recusado pelo profissional: Agenda cheia')
    })
    await prestador.ctx.close()
  })

  test('bloqueio do prestador: avisa o pedido ativo, bloqueia o dia para o tutor e libera ao remover', async ({ page, browser }) => {
    test.setTimeout(5 * 60_000)
    const bianca = await idPrestador()
    const servico = await servicoDe(bianca.id)
    const pet = await cadastrarPetPelaTela(page, `Pingo ${Date.now().toString().slice(-6)}`)
    const { data, horarios } = await diaComHorarios(page, bianca, servico.nome)
    await pedirPelaTela(page, pet, horarios[0])
    const motivo = `Folga ${randomUUID().slice(0, 8)}`

    const prestador = await janela(browser, 'prestador')
    const secao = prestador.page.locator('section').filter({ has: prestador.page.getByRole('heading', { name: 'Bloquear agenda' }) })
    const bloquear = async () => {
      await secao.getByLabel('De', { exact: true }).fill(data)
      await secao.getByLabel('Motivo (opcional)').fill(motivo)
      await secao.getByRole('button', { name: 'Bloquear', exact: true }).click()
    }

    await test.step('com pedido ativo no dia, o bloqueio é recusado e lista o pedido', async () => {
      await prestador.page.goto('/dashboard/prestador')
      await bloquear()
      await expect(secao.locator('.border-red-200')).toContainText(pet)
      expect(await consultar(`select id from bloqueios_agenda where motivo = $1`, [motivo])).toHaveLength(0)
    })

    await test.step('tutor cancela o pedido e o prestador bloqueia o dia', async () => {
      await cancelarPelaTela(page, pet, 'Outro motivo')
      await prestador.page.reload()
      await bloquear()
      await expect(secao.getByRole('listitem').filter({ hasText: motivo })).toContainText(`${dataBR(data)} · dia inteiro`)
    })

    await test.step('tutor não encontra horário no dia bloqueado', async () => {
      await page.goto(`/profissionais/${bianca.id}`)
      expect(await abrirPedido(page, bianca, servico.nome, data)).toEqual([])
      await expect(page.getByText('Sem horários livres nesta data.')).toBeVisible()
    })

    await test.step('prestador remove o bloqueio e o horário volta', async () => {
      const item = secao.getByRole('listitem').filter({ hasText: motivo })
      await item.getByRole('button', { name: 'Remover bloqueio' }).click()
      await expect(item).toHaveCount(0)
      await page.goto(`/profissionais/${bianca.id}`)
      expect(await abrirPedido(page, bianca, servico.nome, data)).toContain(horarios[0])
    })
    await prestador.ctx.close()
  })
})

test.describe('perfil público do profissional', () => {
  test.use({ storageState: SEM_SESSAO })

  test('visitante vê serviços e preço; nem a tela nem a API trazem e-mail, celular ou documentos', async ({ page }) => {
    const bianca = await idPrestador()
    const servico = await servicoDe(bianca.id)
    const [privado] = await consultar<{ email: string; celular: string | null }>(
      `select u.email, u.celular from prestadores p join users u on u.id = p.user_id where p.id = $1`,
      [bianca.id]
    )
    const corpos: string[] = []
    page.on('response', async (r) => {
      if (r.url().includes('/api/')) corpos.push(await r.text().catch(() => ''))
    })
    await page.goto(`/profissionais/${bianca.id}`)
    await expect(page.getByRole('heading', { name: new RegExp(bianca.nome) }).first()).toBeVisible()
    await expect(page.getByText(servico.nome).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Entre como tutor' })).toBeVisible()
    await page.waitForLoadState('networkidle')

    for (const texto of [await page.content(), ...corpos]) {
      expect(texto).not.toContain(privado.email)
      if (privado.celular) expect(texto).not.toContain(privado.celular)
      expect(texto).not.toMatch(/"(cpf|cnpj)"\s*:\s*"\d/)
    }
  })
})
