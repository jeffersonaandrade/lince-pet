import { randomUUID } from 'node:crypto'
import type { Locator, Page } from '@playwright/test'
import { expect, sessao, test } from '../fixtures'
import { agendamento, idClinica, idVeterinario } from '../agenda'
import { consultar } from '../db'
import {
  abrirAgendaDoVet,
  abrirBloqueio,
  agendarPelaTela,
  botoesDeHorario,
  cadastrarPetPelaTela,
  cartaoDoPet,
  dataBR,
  escolherDia,
  escolherDiaPeloCalendario,
  hojeNoNavegador,
  mostrarTodosOsHorarios,
  removerBloqueioPelaTela,
  somarDias,
} from '../telas'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const diaDaSemana = (iso: string) => DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()]
const maisMinutos = (hora: string, min: number) => {
  const total = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) + min
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
const motivoUnico = (base: string) => `${base} ${randomUUID().slice(0, 8)}`
const bloqueiosComMotivo = (motivo: string) => consultar(`select id from bloqueios_agenda where motivo = $1`, [motivo])

/** Janela do tutor já na página do vet; devolve os dias oferecidos. */
async function tutorNaAgenda(browser: import('@playwright/test').Browser, vetId: string) {
  const ctx = await browser.newContext({ storageState: sessao('tutor') })
  const page = await ctx.newPage()
  const dias = await abrirAgendaDoVet(page, vetId)
  return { ctx, page, dias }
}

async function primeiroHorarioLivre(page: Page, dia: string) {
  await escolherDia(page, dia)
  await mostrarTodosOsHorarios(page)
  const livre = botoesDeHorario(page).and(page.locator(':enabled')).filter({ hasText: /:(00|30)$/ }).first()
  return (await livre.textContent())!.trim()
}

async function horarioNaAgenda(page: Page, hora: string) {
  await mostrarTodosOsHorarios(page)
  return botoesDeHorario(page).filter({ hasText: hora })
}

async function marcarSoODia(modal: Locator, alvo: string) {
  for (const nome of DIAS) {
    const chip = modal.getByRole('button', { name: nome, exact: true })
    const marcado = (await chip.getAttribute('aria-pressed')) === 'true'
    if (marcado !== (nome === alvo)) await chip.click()
  }
}

test.describe('bloqueio de agenda pelo painel do vet', () => {
  test.use({ storageState: sessao('veterinario') })

  test('intervalo Das/Até avisa a consulta que cai nele, cancela ao confirmar e some ao remover', async ({ page, browser }) => {
    test.setTimeout(3 * 60_000)
    const vetId = await idVeterinario('veterinario')
    const tutorCtx = await browser.newContext({ storageState: sessao('tutor') })
    const tutor = await tutorCtx.newPage()
    const pet = await cadastrarPetPelaTela(tutor, `Bolinha ${Date.now().toString().slice(-6)}`)
    const consulta = await agendarPelaTela(tutor, vetId, pet)
    const ate = maisMinutos(consulta.hora, 60)
    const motivo = motivoUnico('Congresso')

    const modal = await abrirBloqueio(page)
    await modal.getByLabel('Data').fill(consulta.data)
    await modal.getByLabel('Bloquear o dia inteiro').uncheck()
    await modal.getByLabel('Das').selectOption(consulta.hora)
    await modal.getByLabel('Até').selectOption(ate)
    await modal.getByRole('button', { name: 'Bloquear intervalo' }).click()
    await expect(modal.getByText('Horários bloqueados: 2')).toBeVisible()
    for (const h of [consulta.hora, maisMinutos(consulta.hora, 30)]) {
      await expect(modal.getByRole('button', { name: h, exact: true })).toHaveAttribute('aria-pressed', 'true')
    }
    await expect(modal.getByRole('button', { name: ate, exact: true })).toHaveAttribute('aria-pressed', 'false')
    await modal.getByLabel('Motivo (opcional)').fill(motivo)

    await modal.getByRole('button', { name: 'Bloquear', exact: true }).click()
    await expect(modal.getByText('1 consulta será cancelada e o tutor será avisado:')).toBeVisible()
    await expect(modal.getByText(`${dataBR(consulta.data)} às ${consulta.hora}`)).toContainText(pet)
    expect(await bloqueiosComMotivo(motivo), 'o aviso não grava nada').toHaveLength(0)
    expect((await agendamento(consulta.id)).status).toBe('pendente')

    await modal.getByRole('button', { name: 'Bloquear e cancelar consultas' }).click()
    await expect(page.getByRole('status').filter({ hasText: '1 consulta(s) cancelada(s)' })).toBeVisible()
    expect(await agendamento(consulta.id)).toMatchObject({ status: 'cancelado', motivo_cancelamento: 'Agenda bloqueada pelo profissional' })

    const item = page.getByRole('listitem').filter({ hasText: motivo })
    await expect(item).toContainText(dataBR(consulta.data))
    await expect(item).toContainText(`${consulta.hora}–${ate}`)

    await test.step('tutor vê a consulta cancelada no painel', async () => {
      await tutor.goto('/dashboard/tutor')
      await expect(cartaoDoPet(tutor, pet)).toContainText(/cancelad/i)
    })

    await removerBloqueioPelaTela(page, motivo)
    await tutorCtx.close()
  })

  test('dia inteiro e período: o tutor vê "Agenda indisponível" só nos dias bloqueados; a grade semanal não muda', async ({ page, browser }) => {
    test.setTimeout(3 * 60_000)
    const vetId = await idVeterinario('veterinario')
    const grade = () => consultar(`select id, horarios_funcionamento from veterinario_enderecos where veterinario_id = $1 order by id`, [vetId])
    const gradeAntes = await grade()
    const { ctx, page: tutor, dias } = await tutorNaAgenda(browser, vetId)
    expect(dias.length, 'vet do seed com ao menos 3 dias de atendimento na semana').toBeGreaterThanOrEqual(3)
    const [, d1, d2] = dias
    const indisponivel = tutor.getByText('Agenda indisponível nesta data')

    await test.step(`dia inteiro em ${dataBR(d1)}`, async () => {
      const motivo = motivoUnico('Folga')
      const modal = await abrirBloqueio(page)
      await modal.getByLabel('Data').fill(d1)
      await expect(modal.getByLabel('Bloquear o dia inteiro')).toBeChecked()
      await modal.getByLabel('Motivo (opcional)').fill(motivo)
      await modal.getByRole('button', { name: 'Bloquear', exact: true }).click()
      await expect(modal).toBeHidden()
      const item = page.getByRole('listitem').filter({ hasText: motivo })
      await expect(item).toContainText(dataBR(d1))
      await expect(item).toContainText('Dia inteiro')

      await abrirAgendaDoVet(tutor, vetId)
      await escolherDia(tutor, d1)
      await expect(indisponivel).toBeVisible()
      await escolherDia(tutor, d2)
      await expect(indisponivel).toBeHidden()

      await removerBloqueioPelaTela(page, motivo)
      await abrirAgendaDoVet(tutor, vetId)
      await escolherDia(tutor, d1)
      await expect(indisponivel).toBeHidden()
    })

    await test.step(`período de ${dataBR(d1)} a ${dataBR(d2)}`, async () => {
      const motivo = motivoUnico('Viagem')
      const modal = await abrirBloqueio(page)
      await modal.getByRole('button', { name: 'Período (ex.: uma semana)' }).click()
      await modal.getByLabel('De').fill(d1)
      await modal.getByLabel('Até').fill(d2)
      await modal.getByLabel('Motivo (opcional)').fill(motivo)
      await modal.getByRole('button', { name: 'Bloquear', exact: true }).click()
      await expect(modal).toBeHidden()
      await expect(page.getByRole('listitem').filter({ hasText: motivo })).toContainText(`${dataBR(d1)} a ${dataBR(d2)}`)

      await abrirAgendaDoVet(tutor, vetId)
      for (const d of [d1, d2]) {
        await escolherDia(tutor, d)
        await expect(indisponivel, d).toBeVisible()
      }
      await removerBloqueioPelaTela(page, motivo)
    })

    expect(await grade(), 'bloqueio não mexe na grade semanal do perfil').toEqual(gradeAntes)
    await ctx.close()
  })

  test('toda semana: o horário fica indisponível no dia escolhido e na semana seguinte', async ({ page, browser }) => {
    test.setTimeout(3 * 60_000)
    const vetId = await idVeterinario('veterinario')
    const { ctx, page: tutor, dias } = await tutorNaAgenda(browser, vetId)
    const d1 = dias[1] ?? dias[0]
    const hora = await primeiroHorarioLivre(tutor, d1)
    const motivo = motivoUnico('Plantão')

    const modal = await abrirBloqueio(page)
    await modal.getByRole('button', { name: 'Toda semana' }).click()
    await modal.getByLabel('A partir de').fill(d1)
    await marcarSoODia(modal, diaDaSemana(d1))
    await expect(modal.getByLabel('Sem data final (até eu remover)')).toBeChecked()
    await modal.getByLabel('Bloquear o dia inteiro').uncheck()
    await modal.getByRole('button', { name: hora, exact: true }).click()
    await expect(modal.getByText('Horários bloqueados (em cada dia): 1')).toBeVisible()
    await modal.getByLabel('Motivo (opcional)').fill(motivo)
    await modal.getByRole('button', { name: 'Bloquear', exact: true }).click()
    await expect(modal).toBeHidden()
    await expect(page.getByRole('listitem').filter({ hasText: motivo })).toContainText(
      `Toda semana (${diaDaSemana(d1)}) · a partir de ${dataBR(d1)}`
    )

    await abrirAgendaDoVet(tutor, vetId)
    await escolherDia(tutor, d1)
    await expect(await horarioNaAgenda(tutor, hora)).toBeDisabled()
    await escolherDiaPeloCalendario(tutor, somarDias(d1, 7))
    await expect(await horarioNaAgenda(tutor, hora), 'semana seguinte também').toBeDisabled()

    await removerBloqueioPelaTela(page, motivo)
    await abrirAgendaDoVet(tutor, vetId)
    await escolherDia(tutor, d1)
    await expect(await horarioNaAgenda(tutor, hora)).toBeEnabled()
    await ctx.close()
  })

  test('validações na tela: sem horário, sem dia da semana, data passada, período longo e fim antes do início', async ({ page }) => {
    const hoje = await hojeNoNavegador(page)
    const futura = somarDias(hoje, 40)
    const alerta = (modal: Locator) => modal.getByRole('alert')

    await test.step('sem dia inteiro e sem horário', async () => {
      const modal = await abrirBloqueio(page)
      await modal.getByLabel('Bloquear o dia inteiro').uncheck()
      await modal.getByRole('button', { name: 'Bloquear', exact: true }).click()
      await expect(alerta(modal)).toHaveText('Selecione ao menos um horário ou marque o dia inteiro.')
    })

    await test.step('"Até" só oferece horários depois de "Das"', async () => {
      const modal = page.getByRole('dialog', { name: 'Bloquear agenda' })
      await modal.getByLabel('Das').selectOption('15:00')
      const opcoes = await modal.getByLabel('Até').locator('option').allInnerTexts()
      expect(opcoes.every((h) => h > '15:00')).toBe(true)
      await modal.getByRole('button', { name: 'Voltar' }).click()
    })

    await test.step('toda semana sem nenhum dia marcado', async () => {
      const modal = await abrirBloqueio(page)
      await modal.getByRole('button', { name: 'Toda semana' }).click()
      await marcarSoODia(modal, '')
      await modal.getByRole('button', { name: 'Bloquear', exact: true }).click()
      await expect(alerta(modal)).toHaveText('Selecione ao menos um dia da semana.')
      await modal.getByRole('button', { name: 'Voltar' }).click()
    })

    const casos: { nome: string; preencher: (modal: Locator) => Promise<void> }[] = [
      { nome: 'data passada', preencher: (m) => m.getByLabel('Data').fill(somarDias(hoje, -2)) },
      {
        nome: 'período acima de 31 dias',
        preencher: async (m) => {
          await m.getByRole('button', { name: 'Período (ex.: uma semana)' }).click()
          await m.getByLabel('De').fill(futura)
          await m.getByLabel('Até').fill(somarDias(futura, 31))
        },
      },
      {
        nome: 'fim antes do início',
        preencher: async (m) => {
          await m.getByRole('button', { name: 'Período (ex.: uma semana)' }).click()
          await m.getByLabel('De').fill(futura)
          await m.getByLabel('Até').fill(somarDias(futura, -1))
        },
      },
    ]
    for (const caso of casos) {
      await test.step(caso.nome, async () => {
        const motivo = motivoUnico('Invalido')
        const modal = await abrirBloqueio(page)
        await caso.preencher(modal)
        await modal.getByLabel('Motivo (opcional)').fill(motivo)
        await modal.getByRole('button', { name: 'Bloquear', exact: true }).click()
        await expect(alerta(modal)).toBeVisible()
        await expect(modal).toBeVisible()
        expect(await bloqueiosComMotivo(motivo)).toHaveLength(0)
        await modal.getByRole('button', { name: 'Voltar' }).click()
      })
    }
  })
})

test.describe('bloqueio pela clínica', () => {
  test.use({ storageState: sessao('clinica') })

  test('clínica escolhe um vet vinculado, bloqueia o dia e remove; vet sem vínculo não aparece na lista', async ({ page }) => {
    const clinicaId = await idClinica()
    const vinculados = await consultar<{ id: string }>(
      `select vc.veterinario_id as id from veterinario_clinicas vc where vc.clinica_id = $1 and vc.status = 'aceito'`,
      [clinicaId]
    )
    test.skip(vinculados.length === 0, 'Seed sem vet vinculado à clínica')
    const [semVinculo] = await consultar<{ id: string }>(
      `select v.id from veterinarios v where not exists (
         select 1 from veterinario_clinicas vc where vc.veterinario_id = v.id and vc.clinica_id = $1 and vc.status = 'aceito')
       limit 1`,
      [clinicaId]
    )
    const alvo = vinculados[0]
    const data = somarDias(await hojeNoNavegador(page), 45)
    const motivo = motivoUnico('Reforma')

    await page.goto('/dashboard/clinica')
    const seletor = page.getByLabel('Gerenciar bloqueios do profissional')
    await expect(seletor.locator('option')).toHaveCount(vinculados.length)
    const opcoes = await seletor.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))
    expect(opcoes.toSorted()).toEqual(vinculados.map((v) => v.id).toSorted())
    expect(opcoes).not.toContain(semVinculo.id)
    await seletor.selectOption(alvo.id)

    await page.getByRole('button', { name: 'Bloquear agenda' }).click()
    const modal = page.getByRole('dialog', { name: 'Bloquear agenda' })
    await modal.getByLabel('Data').fill(data)
    await modal.getByLabel('Motivo (opcional)').fill(motivo)
    await modal.getByRole('button', { name: 'Bloquear', exact: true }).click()
    await expect(modal).toBeHidden()
    await expect(page.getByRole('listitem').filter({ hasText: motivo })).toContainText(dataBR(data))
    const [gravado] = await consultar<{ veterinario_id: string; clinica_id: string }>(
      `select veterinario_id, clinica_id from bloqueios_agenda where motivo = $1`,
      [motivo]
    )
    expect(gravado).toMatchObject({ veterinario_id: alvo.id, clinica_id: clinicaId })

    await test.step('invasão (fora da tela): bloquear vet sem vínculo pelo id', async () => {
      const negado = await page.request.post(`/api/clinicas/veterinarios/${semVinculo.id}/bloqueios`, { data: { data_inicio: data } })
      expect([403, 404]).toContain(negado.status())
    })

    await removerBloqueioPelaTela(page, motivo)
  })
})
