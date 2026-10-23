import { randomUUID } from 'node:crypto'
import { expect, sessao, test } from '../fixtures'
import { apiComo, idVeterinario, iniciarConsulta, marcarConsulta, novoPet } from '../agenda'

const dataBR = (iso: string) => iso.split('-').reverse().join('/')

test.describe('prontuário visto pelo tutor (item 8)', () => {
  test.use({ storageState: sessao('tutor') })

  test('pet novo sem registros; depois da consulta, a linha do tempo mostra o registro e não a anotação privada', async ({ page }) => {
    const [tutor, vet] = await Promise.all([apiComo('tutor'), apiComo('veterinario')])
    const pet = await novoPet(tutor, `Prontuario ${Date.now()}`)
    const abrir = async () => {
      await page.goto('/dashboard/tutor')
      await page.getByRole('button', { name: `Ver prontuário de ${pet.nome}` }).click()
      return page.getByRole('dialog', { name: `Prontuário de ${pet.nome}` })
    }

    let modal = await abrir()
    await expect(modal.getByText('Este pet ainda não tem registros.')).toBeVisible()
    await modal.getByRole('button', { name: 'Fechar' }).click()
    await expect(modal).toBeHidden()

    const consulta = await marcarConsulta(tutor, { veterinarioId: await idVeterinario('veterinario'), petId: pet.id })
    await iniciarConsulta(vet, consulta.id)
    const diagnostico = `Otite leve ${randomUUID().slice(0, 8)}`
    const segredo = `Anotacao privada ${randomUUID()}`
    expect((await vet.put(`/api/veterinarios/agendamentos/${consulta.id}/registro`, { data: { diagnostico, peso_kg: 12.5 } })).status()).toBe(200)
    expect((await vet.put(`/api/veterinarios/agendamentos/${consulta.id}/anotacao`, { data: { observacoes: segredo } })).status()).toBe(200)

    modal = await abrir()
    const item = modal.getByRole('button', { name: new RegExp(`${dataBR(consulta.data)} às ${consulta.horario}`) })
    await expect(item).toContainText('Com registro')
    await expect(modal.getByText('Último peso:')).toContainText('12.5 kg')
    await item.click()
    await expect(modal.getByText(diagnostico)).toBeVisible()
    await expect(modal).not.toContainText(segredo)
  })
})
