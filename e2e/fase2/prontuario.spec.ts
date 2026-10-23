import { randomUUID } from 'node:crypto'
import { expect, sessao, test } from '../fixtures'
import { agendamento, idVeterinario, petsDoTutor } from '../agenda'
import { consultar } from '../db'
import {
  abrirConsultaNoPainelDoVet,
  agendarPelaTela,
  cadastrarPetPelaTela,
  codigoDeInicio,
  iniciarAtendimentoPelaTela,
} from '../telas'

const nomePet = (base: string) => `${base} ${Date.now().toString().slice(-6)}`

test.describe('pets e prontuário pela tela', () => {
  test.use({ storageState: sessao('tutor') })

  test('o painel do tutor lista só os próprios pets', async ({ page }) => {
    await page.goto('/dashboard/tutor')
    const meus = (await petsDoTutor('tutor')).map((p) => p.nome)
    const deOutro = (await petsDoTutor('tutor2')).map((p) => p.nome).filter((n) => !meus.includes(n))
    const botoes = page.getByRole('button', { name: /^Ver prontuário de / })
    await expect(botoes.first()).toBeVisible()
    const naTela = (await botoes.allInnerTexts()).length
    expect(naTela).toBe(meus.length)
    for (const nome of meus) await expect(page.getByRole('button', { name: `Ver prontuário de ${nome}`, exact: true })).toBeVisible()
    for (const nome of deOutro) await expect(page.getByRole('button', { name: `Ver prontuário de ${nome}`, exact: true })).toHaveCount(0)

    await test.step('invasão (fora da tela): prontuário, edição e exclusão de pet de outro tutor respondem 404', async () => {
      const [petAlheio] = await petsDoTutor('tutor2')
      expect((await page.request.get(`/api/pets/${petAlheio.id}/prontuario`)).status()).toBe(404)
      expect((await page.request.patch(`/api/pets/${petAlheio.id}`, { data: { nome: 'Invadido' } })).status()).toBe(404)
      expect((await page.request.delete(`/api/pets/${petAlheio.id}`)).status()).toBe(404)
    })
  })

  test('tutor cadastra, edita e exclui um pet pela tela', async ({ page }) => {
    const nome = await cadastrarPetPelaTela(page, nomePet('Pipoca'))
    await page.getByRole('button', { name: `Editar ${nome}` }).click()
    const modal = page.getByRole('dialog', { name: 'Editar Pet' })
    await expect(modal.getByLabel('Nome')).toHaveValue(nome)
    const novo = `${nome} Jr`
    await modal.getByLabel('Nome').fill(novo)
    await modal.getByRole('button', { name: 'Salvar Pet' }).click()
    await expect(modal).toBeHidden()
    await expect(page.getByRole('button', { name: `Ver prontuário de ${novo}` })).toBeVisible()

    await page.getByRole('button', { name: `Editar ${novo}` }).click()
    page.once('dialog', (d) => d.accept())
    await page.getByRole('dialog', { name: 'Editar Pet' }).getByRole('button', { name: 'Excluir' }).click()
    await expect(page.getByRole('button', { name: `Ver prontuário de ${novo}` })).toHaveCount(0)
    expect(await consultar(`select 1 from pets where nome = $1`, [novo])).toHaveLength(0)
  })

  test('pet sem consulta mostra o prontuário vazio', async ({ page }) => {
    const nome = await cadastrarPetPelaTela(page, nomePet('Bento'))
    await page.getByRole('button', { name: `Ver prontuário de ${nome}` }).click()
    await expect(page.getByRole('dialog', { name: `Prontuário de ${nome}` }).getByText('Este pet ainda não tem registros.')).toBeVisible()
  })
})

test.describe('anotação privada e registro clínico pela tela', () => {
  test('a anotação só aparece para o vet que escreveu; o registro clínico chega ao tutor', async ({ browser }) => {
    test.setTimeout(4 * 60_000)
    const tutorCtx = await browser.newContext({ storageState: sessao('tutor') })
    const vetCtx = await browser.newContext({ storageState: sessao('veterinario') })
    const tutor = await tutorCtx.newPage()
    const vet = await vetCtx.newPage()
    const segredo = `SEGREDO-${randomUUID().slice(0, 8)}`
    const diagnostico = `Diagnostico ${randomUUID().slice(0, 8)}`

    const pet = await cadastrarPetPelaTela(tutor, nomePet('Kiara'))
    const consulta = await agendarPelaTela(tutor, await idVeterinario('veterinario'), pet)

    await test.step('invasão (fora da tela): anotar antes de iniciar o atendimento é recusado', async () => {
      const res = await vet.request.put(`/api/veterinarios/agendamentos/${consulta.id}/anotacao`, { data: { observacoes: segredo } })
      expect(res.status()).toBe(400)
    })

    const emAndamento = await iniciarAtendimentoPelaTela(vet, consulta, pet, await codigoDeInicio(tutor, pet))

    await test.step('vet salva o registro clínico', async () => {
      await emAndamento.getByLabel('Peso (kg)').fill('8.2')
      await emAndamento.getByLabel('Diagnóstico / avaliação').fill(diagnostico)
      await emAndamento.getByRole('button', { name: 'Salvar registro' }).click()
      await expect(emAndamento.getByRole('status').filter({ hasText: 'Registro clínico salvo.' })).toBeVisible()
    })

    await test.step('vet salva a anotação privada com pagamento por plano', async () => {
      await emAndamento.getByLabel(/^Pagamento/).selectOption('pago')
      await emAndamento.getByLabel('Forma de pagamento').selectOption('plano_pet')
      await emAndamento.getByLabel('Plano usado').fill('Pet Love')
      await emAndamento.getByLabel('Observações do paciente').fill(segredo)
      await emAndamento.getByRole('button', { name: 'Salvar anotação' }).click()
      await expect(emAndamento.getByRole('status').filter({ hasText: 'Anotação salva.' })).toBeVisible()
    })

    await test.step('vet fecha e reabre: a anotação continua lá', async () => {
      await abrirConsultaNoPainelDoVet(vet, consulta, pet)
      const recarregada = vet.getByRole('dialog').filter({ hasText: 'Consulta em Andamento' })
      await expect(recarregada.getByLabel('Observações do paciente')).toHaveValue(segredo)
      await expect(recarregada.getByLabel('Plano usado')).toHaveValue('Pet Love')
    })

    await test.step('o campo de observações não aceita mais de 5.000 caracteres', async () => {
      const campo = vet.getByRole('dialog').filter({ hasText: 'Consulta em Andamento' }).getByLabel('Observações do paciente')
      await campo.fill('a'.repeat(5001))
      expect((await campo.inputValue()).length).toBe(5000)
      await campo.fill(segredo)
    })

    await test.step('tutor vê o diagnóstico no prontuário e não vê a anotação', async () => {
      await tutor.goto('/dashboard/tutor')
      await expect(tutor.locator('body')).not.toContainText(segredo)
      await tutor.getByRole('button', { name: `Ver prontuário de ${pet}` }).click()
      const prontuario = tutor.getByRole('dialog', { name: `Prontuário de ${pet}` })
      await prontuario.getByText('Com registro').click()
      await expect(prontuario.getByText(diagnostico)).toBeVisible()
      await expect(prontuario).not.toContainText(segredo)
    })

    await test.step('outro vet e a clínica não veem a anotação nos painéis deles', async () => {
      for (const perfil of ['veterinario2', 'clinica'] as const) {
        const ctx = await browser.newContext({ storageState: sessao(perfil) })
        const p = await ctx.newPage()
        await p.goto(perfil === 'clinica' ? '/dashboard/clinica' : '/dashboard/veterinario')
        await expect(p.locator('body')).not.toContainText(segredo)
        await test.step(`invasão (fora da tela): ${perfil} lendo a anotação pelo id`, async () => {
          expect([403, 404]).toContain((await p.request.get(`/api/veterinarios/agendamentos/${consulta.id}/anotacao`)).status())
        })
        await ctx.close()
      }
      expect((await tutor.request.get(`/api/veterinarios/agendamentos/${consulta.id}/anotacao`)).status()).toBe(403)
    })

    const { payment_status } = await agendamento(consulta.id)
    expect(payment_status, 'pagamento anotado pelo vet não mexe no pagamento da consulta').toBe('unpaid')

    await vet.getByRole('dialog').filter({ hasText: 'Consulta em Andamento' }).getByRole('button', { name: 'Finalizar Atendimento' }).click()
    await expect.poll(async () => (await agendamento(consulta.id)).status).toBe('realizado')
    await tutorCtx.close()
    await vetCtx.close()
  })

  test('invasão (fora da tela): vet sem consulta com o pet não abre o prontuário', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: sessao('veterinario2') })
    const vet2 = await ctx.newPage()
    await vet2.goto('/dashboard/veterinario')
    const [pet] = await consultar<{ id: string }>(
      `select p.id from pets p
       where not exists (select 1 from agendamentos a where a.pet_id = p.id and a.veterinario_id = $1)
         and not exists (select 1 from encaminhamentos e where e.pet_id = p.id)
       limit 1`,
      [await idVeterinario('veterinario2')]
    )
    expect(pet, 'seed sem pet livre para o teste').toBeTruthy()
    expect((await vet2.request.get(`/api/pets/${pet.id}/prontuario`)).status()).toBe(404)
    await ctx.close()
  })
})