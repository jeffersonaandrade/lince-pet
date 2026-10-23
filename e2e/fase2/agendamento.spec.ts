import { expect, SEM_SESSAO, sessao, test } from '../fixtures'
import { idVeterinario, petsDoTutor } from '../agenda'
import { consultar } from '../db'
import {
  abrirAgendaDoVet,
  abrirBloqueio,
  agendarPelaTela,
  botoesDeHorario,
  cadastrarPetPelaTela,
  cancelarPelaTela,
  cartaoDoPet,
  escolherDia,
  hojeNoNavegador,
  mostrarTodosOsHorarios,
  removerBloqueioPelaTela,
  statusDaConsulta,
} from '../telas'
import { MOTIVOS_CANCELAMENTO_TUTOR } from '../../src/lib/motivos-cancelamento'

const nomePet = (base: string) => `${base} ${Date.now().toString().slice(-6)}`

test.describe('agendamento pela tela', () => {
  test.use({ storageState: sessao('tutor') })

  test('tutor cadastra o pet, escolhe local, dia e horário, confirma e a consulta aparece no painel', async ({ page }) => {
    const vetId = await idVeterinario('veterinario')
    const pet = await cadastrarPetPelaTela(page, nomePet('Bidu'))

    await page.goto(`/veterinario/${vetId}`)
    await expect(page.getByRole('button', { name: 'Agendar', exact: true })).toBeDisabled()
    const consulta = await agendarPelaTela(page, vetId, pet)

    await page.goto('/dashboard/tutor')
    await expect(cartaoDoPet(page, pet)).toContainText(consulta.hora)
    await expect(cartaoDoPet(page, pet)).toContainText('Código de início')
    await cancelarPelaTela(page, pet, 'Outro motivo')
  })

  test('horário já marcado aparece desabilitado e a lista de dias não começa no passado', async ({ page }) => {
    const vetId = await idVeterinario('veterinario')
    const pet = await cadastrarPetPelaTela(page, nomePet('Nina'))
    const consulta = await agendarPelaTela(page, vetId, pet)

    const dias = await abrirAgendaDoVet(page, vetId)
    expect(dias[0] >= (await hojeNoNavegador(page)), 'primeiro dia oferecido é hoje ou depois').toBe(true)
    await escolherDia(page, consulta.data)
    await mostrarTodosOsHorarios(page)
    await expect(botoesDeHorario(page).filter({ hasText: consulta.hora })).toBeDisabled()

    await cancelarPelaTela(page, pet, 'Outro motivo')
    await abrirAgendaDoVet(page, vetId)
    await escolherDia(page, consulta.data)
    await mostrarTodosOsHorarios(page)
    await expect(botoesDeHorario(page).filter({ hasText: consulta.hora }), 'cancelada libera o horário').toBeEnabled()
  })

  test('o modal de confirmação só oferece os pets do próprio tutor', async ({ page }) => {
    const vetId = await idVeterinario('veterinario')
    await abrirAgendaDoVet(page, vetId)
    await botoesDeHorario(page).and(page.locator(':enabled')).first().click()
    await page.getByRole('button', { name: 'Agendar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Confirmar Agendamento' })).toBeVisible()

    const meus = (await petsDoTutor('tutor')).map((p) => p.nome)
    const deOutro = (await petsDoTutor('tutor2')).map((p) => p.nome).filter((n) => !meus.includes(n))
    const naTela = await page.locator('[class*="petCard"] [class*="petName"]').allInnerTexts()
    expect(naTela.toSorted()).toEqual(meus.toSorted())
    for (const nome of deOutro) expect(naTela).not.toContain(nome)

    await test.step('invasão (fora da tela): mandar o id de um pet de outro tutor é recusado', async () => {
      const [petAlheio] = await petsDoTutor('tutor2')
      const res = await page.request.post('/api/agendamentos', {
        data: { veterinario_id: vetId, pet_id: petAlheio.id, data_consulta: '2099-01-10', horario_consulta: '10:00', tipo_consulta: 'online' },
      })
      expect(res.status()).toBe(400)
    })
  })

  test('vet bloqueia um horário pelo painel e o tutor vê indisponível; ao remover, volta a ficar livre', async ({ page, browser }) => {
    const vetId = await idVeterinario('veterinario')
    const dias = await abrirAgendaDoVet(page, vetId)
    const dia = dias[1] ?? dias[0]
    await escolherDia(page, dia)
    await mostrarTodosOsHorarios(page)
    const livre = botoesDeHorario(page).and(page.locator(':enabled')).filter({ hasText: /:(00|30)$/ }).first()
    const hora = (await livre.textContent())!.trim()
    const motivo = `Bloqueio E2E ${Date.now()}`

    const vetCtx = await browser.newContext({ storageState: sessao('veterinario') })
    const vet = await vetCtx.newPage()
    await test.step(`vet bloqueia ${dia} às ${hora}`, async () => {
      const modal = await abrirBloqueio(vet)
      await modal.getByLabel('Data').fill(dia)
      await modal.getByLabel('Bloquear o dia inteiro').uncheck()
      await modal.getByRole('button', { name: hora, exact: true }).click()
      await expect(modal.getByText('Horários bloqueados: 1')).toBeVisible()
      await modal.getByLabel('Motivo (opcional)').fill(motivo)
      await modal.getByRole('button', { name: 'Bloquear', exact: true }).click()
      await expect(modal).toBeHidden()
      await expect(vet.getByRole('listitem').filter({ hasText: motivo })).toBeVisible()
    })

    await test.step('tutor recarrega e o horário está indisponível', async () => {
      await abrirAgendaDoVet(page, vetId)
      await escolherDia(page, dia)
      await mostrarTodosOsHorarios(page)
      await expect(botoesDeHorario(page).filter({ hasText: hora })).toBeDisabled()
    })

    await test.step('vet remove o bloqueio e o horário volta', async () => {
      await removerBloqueioPelaTela(vet, motivo)
      await abrirAgendaDoVet(page, vetId)
      await escolherDia(page, dia)
      await mostrarTodosOsHorarios(page)
      await expect(botoesDeHorario(page).filter({ hasText: hora })).toBeEnabled()
    })
    await vetCtx.close()
  })

  test('cancelar: o modal só tem os motivos da lista fixa, sem campo de texto, e grava o texto padrão', async ({ page }) => {
    const vetId = await idVeterinario('veterinario')
    const pet = await cadastrarPetPelaTela(page, nomePet('Fred'))
    const consulta = await agendarPelaTela(page, vetId, pet)

    await page.goto('/dashboard/tutor')
    await cartaoDoPet(page, pet).getByRole('button', { name: 'Cancelar', exact: true }).click()
    const modal = page.getByRole('dialog', { name: 'Cancelar Consulta' })
    const opcoes = await modal.getByRole('radio').evaluateAll((els) => els.map((e) => e.parentElement!.textContent!.trim()))
    expect(opcoes).toEqual(Object.values(MOTIVOS_CANCELAMENTO_TUTOR))
    await expect(modal.getByRole('textbox')).toHaveCount(0)
    await expect(modal.getByRole('button', { name: 'Confirmar Cancelamento' })).toBeDisabled()

    await modal.getByRole('radio', { name: 'O pet melhorou' }).check()
    await modal.getByRole('button', { name: 'Confirmar Cancelamento' }).click()
    await expect(modal).toBeHidden()
    await expect.poll(() => statusDaConsulta(consulta.id)).toBe('cancelado')
    const [{ motivo_cancelamento }] = await consultar<{ motivo_cancelamento: string }>(
      `select motivo_cancelamento from agendamentos where id = $1`,
      [consulta.id]
    )
    expect(motivo_cancelamento).toBe('O pet melhorou')
    await page.reload()
    await expect(cartaoDoPet(page, pet)).toContainText(/cancelad/i)
    await expect(cartaoDoPet(page, pet).getByRole('button', { name: 'Cancelar', exact: true })).toHaveCount(0)

    await test.step('invasão (fora da tela): texto livre mandado direto vira o motivo padrão', async () => {
      const outra = await agendarPelaTela(page, vetId, pet)
      await page.request.patch(`/api/agendamentos/${outra.id}/cancelar`, { data: { motivo: 'Ligue para 0800 e informe seus dados' } })
      const [{ m }] = await consultar<{ m: string }>(`select motivo_cancelamento m from agendamentos where id = $1`, [outra.id])
      expect(m).toBe('Cancelado pelo tutor')
    })
  })

  test('outro tutor não vê a consulta no painel dele', async ({ page, browser }) => {
    const pet = await cadastrarPetPelaTela(page, nomePet('Toby'))
    const consulta = await agendarPelaTela(page, await idVeterinario('veterinario'), pet)

    const outroCtx = await browser.newContext({ storageState: sessao('tutor2') })
    const outro = await outroCtx.newPage()
    await outro.goto('/dashboard/tutor')
    await expect(outro.getByRole('heading', { name: /Próximas Consultas/ })).toBeVisible()
    await expect(outro.getByText(pet)).toHaveCount(0)

    await test.step('invasão (fora da tela): o outro tutor tentando cancelar ou remarcar pelo id recebe 404', async () => {
      expect((await outro.request.patch(`/api/agendamentos/${consulta.id}/cancelar`, { data: { motivo: 'outro' } })).status()).toBe(404)
      expect(
        (await outro.request.patch(`/api/agendamentos/${consulta.id}/reagendar`, { data: { data_consulta: consulta.data, horario_consulta: '23:30' } })).status()
      ).toBe(404)
      expect(await statusDaConsulta(consulta.id)).toBe('pendente')
    })
    await outroCtx.close()
    await cancelarPelaTela(page, pet, 'Outro motivo')
  })

  test('remarcar pela tela: horário ocupado não é oferecido, data mínima é hoje e a nova data/hora é gravada', async ({ page }) => {
    const vetId = await idVeterinario('veterinario')
    const petA = await cadastrarPetPelaTela(page, nomePet('Luna'))
    const petB = await cadastrarPetPelaTela(page, nomePet('Max'))
    const a = await agendarPelaTela(page, vetId, petA)
    const b = await agendarPelaTela(page, vetId, petB, { dia: a.data })

    await page.goto('/dashboard/tutor')
    await cartaoDoPet(page, petA).getByRole('button', { name: 'Reagendar' }).click()
    const modal = page.getByRole('dialog', { name: 'Reagendar Consulta' })
    await expect(modal.getByLabel('Nova Data')).toHaveValue(a.data)
    await expect(modal.getByLabel('Nova Data')).toHaveAttribute('min', await hojeNoNavegador(page))
    await expect(modal.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first()).toBeVisible()
    await expect(modal.getByRole('button', { name: b.hora, exact: true }), 'horário da outra consulta não aparece').toHaveCount(0)

    const novo = modal.getByRole('button', { name: /^\d{2}:\d{2}$/, pressed: false }).first()
    const novaHora = (await novo.textContent())!.trim()
    await novo.click()
    await modal.getByRole('button', { name: 'Confirmar Reagendamento' }).click()
    await expect(modal).toBeHidden()
    await expect(cartaoDoPet(page, petA)).toContainText(novaHora)
    await expect
      .poll(async () => (await consultar<{ h: string }>(`select horario_consulta h from agendamentos where id = $1`, [a.id]))[0].h)
      .toBe(novaHora)

    await cancelarPelaTela(page, petA, 'Outro motivo')
    await cancelarPelaTela(page, petB, 'Outro motivo')
  })
})

test.describe('sem login', () => {
  test.use({ storageState: SEM_SESSAO })

  test('Agendar leva ao login', async ({ page }) => {
    await abrirAgendaDoVet(page, await idVeterinario('veterinario'))
    const horario = botoesDeHorario(page).and(page.locator(':enabled')).first()
    test.skip(!(await horario.isVisible().catch(() => false)), 'sem horário livre')
    await horario.click()
    await page.getByRole('button', { name: 'Agendar', exact: true }).click()
    await expect(page, 'depois de entrar, volta para a agenda do vet').toHaveURL(/\/login\?next=%2Fveterinario%2F/)
  })
})