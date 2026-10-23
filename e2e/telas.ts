import { expect, type Page } from '@playwright/test'
import { consultar } from './db'

/** Ajudantes que fazem as ações pelas telas (nada de chamar a API direto). */

export const dataBR = (iso: string) => iso.split('-').reverse().join('/')

export function somarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export const hojeNoNavegador = (page: Page) => page.evaluate(() => new Date().toLocaleDateString('en-CA'))

/** Tutor logado: "+ Adicionar Pet" no painel. Devolve o nome usado. */
export async function cadastrarPetPelaTela(page: Page, nome: string) {
  await page.goto('/dashboard/tutor')
  await page.getByRole('button', { name: '+ Adicionar Pet' }).click()
  const modal = page.getByRole('dialog', { name: 'Adicionar Pet' })
  await modal.getByLabel('Nome').fill(nome)
  await modal.getByLabel('Espécie').selectOption('Canina')
  await modal.getByLabel('Raça').selectOption('SRD (Sem Raça Definida)')
  await modal.getByLabel('Porte').selectOption('medio')
  await modal.getByLabel('Idade (anos)').fill('3')
  await modal.getByRole('button', { name: 'Salvar Pet' }).click()
  await expect(modal).toBeHidden()
  await expect(page.getByRole('button', { name: `Ver prontuário de ${nome}` })).toBeVisible()
  return nome
}

/** Página pública do vet, já em Teleconsulta. Devolve os dias da lista com a data ISO de cada um. */
export async function abrirAgendaDoVet(page: Page, vetId: string) {
  await page.goto(`/veterinario/${vetId}`)
  await page.getByText('Escolha um local').click()
  await page.getByText('Teleconsulta', { exact: true }).click()
  const dias = page.locator('[class*="dateOption"]')
  await expect(dias.first()).toBeVisible()
  return page.evaluate(() => {
    const cursor = new Date()
    return [...document.querySelectorAll('[class*="dateOption"] [class*="dayNumber"]')].map((el) => {
      const n = Number(el.textContent)
      while (cursor.getDate() !== n) cursor.setDate(cursor.getDate() + 1)
      return cursor.toLocaleDateString('en-CA')
    })
  })
}

export const botoesDeHorario = (page: Page) => page.locator('[class*="timeSlots"]').getByRole('button', { name: /^\d{2}:\d{2}$/ })

export async function escolherDia(page: Page, iso: string) {
  const dias = await page.evaluate(() =>
    [...document.querySelectorAll('[class*="dateOption"] [class*="dayNumber"]')].map((el) => Number(el.textContent))
  )
  const indice = dias.indexOf(Number(iso.slice(8, 10)))
  expect(indice, `dia ${iso} na lista da agenda`).toBeGreaterThanOrEqual(0)
  const ocupados = page
    .waitForResponse((r) => r.url().includes(`/agendamentos/disponibilidade/`) && r.url().includes(`data=${iso}`), { timeout: 5_000 })
    .catch(() => null)
  await page.locator('[class*="dateOption"]').nth(indice).click()
  await ocupados
  await expect(page.locator('[class*="timeSlots"]').getByText('Carregando...')).toHaveCount(0)
}

const MESES = [
  ['january', 'janeiro'], ['february', 'fevereiro'], ['march', 'março'], ['april', 'abril'], ['may', 'maio'], ['june', 'junho'],
  ['july', 'julho'], ['august', 'agosto'], ['september', 'setembro'], ['october', 'outubro'], ['november', 'novembro'], ['december', 'dezembro'],
]

/** Dia fora da semana visível: botão "Data" e o calendário. */
export async function escolherDiaPeloCalendario(page: Page, iso: string) {
  await page.getByRole('button', { name: 'Data', exact: true }).click()
  const rotulo = page.locator('[class*="monthLabel"]')
  const [ano, mes] = iso.split('-').map(Number)
  for (let i = 0; i < 24; i++) {
    const [nome, a] = (await rotulo.textContent())!.toLowerCase().trim().split(' ')
    const atual = Number(a) * 12 + MESES.findIndex((m) => m.includes(nome))
    const alvo = ano * 12 + (mes - 1)
    if (atual === alvo) break
    await page.locator('[class*="navBtn"]').nth(atual < alvo ? 1 : 0).click()
  }
  const ocupados = page
    .waitForResponse((r) => r.url().includes(`/agendamentos/disponibilidade/`) && r.url().includes(`data=${iso}`), { timeout: 5_000 })
    .catch(() => null)
  await page
    .locator('[class*="daysGrid"] [class*="day"]:not([class*="otherMonth"])')
    .getByText(String(Number(iso.slice(8, 10))), { exact: true })
    .click()
  await ocupados
  await expect(page.locator('[class*="timeSlots"]').getByText('Carregando...')).toHaveCount(0)
}

/** Mostra todos os horários do dia (o botão "Mais (N)" esconde a partir do 7º). */
export async function mostrarTodosOsHorarios(page: Page) {
  const mais = page.getByRole('button', { name: /^Mais \(\d+\)/ })
  if (await mais.isVisible()) await mais.click()
}

/** Agenda pela página do vet: dia (ISO) e horário opcionais; sem horário, pega o primeiro livre. */
export async function agendarPelaTela(page: Page, vetId: string, petNome: string, opcoes: { dia?: string; hora?: string } = {}) {
  const dias = await abrirAgendaDoVet(page, vetId)
  const dia = opcoes.dia ?? dias[1] ?? dias[0]
  await escolherDia(page, dia)
  await mostrarTodosOsHorarios(page)
  const botao = opcoes.hora
    ? botoesDeHorario(page).filter({ hasText: opcoes.hora })
    : botoesDeHorario(page).and(page.locator(':enabled')).first()
  await expect(botao).toBeEnabled()
  const hora = (await botao.textContent())!.trim()
  await botao.click()
  await page.getByRole('button', { name: 'Agendar', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Confirmar Agendamento' })).toBeVisible()
  await page.locator('[class*="petCard"]').filter({ hasText: petNome }).click()
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Confirmar Agendamento' })).toBeHidden()

  const [consulta] = await consultar<{ id: string }>(
    `select a.id from agendamentos a join pets p on p.id = a.pet_id
     where p.nome = $1 and a.horario_consulta = $2 and a.data_consulta::date = $3::date and a.status = 'pendente'`,
    [petNome, hora, dia]
  )
  expect(consulta, `consulta de ${petNome} em ${dia} às ${hora} gravada`).toBeTruthy()
  return { id: consulta.id, data: dia, hora }
}

/** Cartão da consulta no painel do tutor (o pet é único por teste). */
export const cartaoDoPet = (page: Page, petNome: string) => page.locator('[class*="appointmentItem"]').filter({ hasText: petNome })

export async function cancelarPelaTela(page: Page, petNome: string, motivo: string) {
  await page.goto('/dashboard/tutor')
  await cartaoDoPet(page, petNome).getByRole('button', { name: 'Cancelar', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Cancelar Consulta' })
  await modal.getByRole('radio', { name: motivo }).check()
  await modal.getByRole('button', { name: 'Confirmar Cancelamento' }).click()
  await expect(modal).toBeHidden()
}

/** Vet logado: abre "Bloquear agenda" no painel. */
export async function abrirBloqueio(page: Page, painel = '/dashboard/veterinario') {
  await page.goto(painel)
  await page.getByRole('button', { name: 'Bloquear agenda' }).first().click()
  const modal = page.getByRole('dialog', { name: 'Bloquear agenda' })
  await expect(modal).toBeVisible()
  return modal
}

/** Item da lista de bloqueios, achado pelo motivo; remove confirmando o diálogo do navegador. */
export async function removerBloqueioPelaTela(page: Page, motivo: string) {
  const item = page.getByRole('listitem').filter({ hasText: motivo })
  page.once('dialog', (d) => d.accept())
  await item.getByRole('button', { name: 'Remover bloqueio' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Bloqueio removido.' })).toBeVisible()
  await expect(item).toHaveCount(0)
}

/** Código de início que o tutor vê no cartão da consulta. */
export async function codigoDeInicio(page: Page, petNome: string) {
  await page.goto('/dashboard/tutor')
  const cartao = cartaoDoPet(page, petNome)
  await expect(cartao).toContainText('Código de início')
  return (await cartao.locator('.font-mono').textContent())!.trim()
}

/** Vet navega até o dia da consulta, informa o código e abre "Consulta em Andamento". */
export async function abrirConsultaNoPainelDoVet(page: Page, consulta: { data: string; hora: string }, petNome: string) {
  await page.goto('/dashboard/veterinario')
  const dias = Math.round((Date.parse(consulta.data) - Date.parse(await hojeNoNavegador(page))) / 86_400_000)
  for (let i = 0; i < dias; i++) await page.getByRole('button', { name: 'Próximo dia' }).click()
  const item = page.getByRole('article', { name: new RegExp(`às ${consulta.hora} para .* e pet ${petNome}`) })
  await item.click()
  return item
}

export async function iniciarAtendimentoPelaTela(page: Page, consulta: { data: string; hora: string }, petNome: string, codigo: string) {
  const item = await abrirConsultaNoPainelDoVet(page, consulta, petNome)
  const modal = page.getByRole('dialog').filter({ hasText: 'Detalhes e Início da Consulta' })
  await modal.getByLabel('Código de início da consulta').fill(codigo)
  await modal.getByRole('button', { name: 'Confirmar e Iniciar' }).click()
  await expect(modal).toBeHidden()
  await item.click()
  const emAndamento = page.getByRole('dialog').filter({ hasText: 'Consulta em Andamento' })
  await expect(emAndamento).toBeVisible()
  return emAndamento
}

export const statusDaConsulta = async (id: string) =>
  (await consultar<{ status: string }>(`select status from agendamentos where id = $1`, [id]))[0]?.status
