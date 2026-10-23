import type { Page } from '@playwright/test'
import { expect, SEM_SESSAO, sessao, test } from '../fixtures'
import { idVeterinario } from '../agenda'
import { consultar } from '../db'

// A busca por plano em /explorar (vets e clínicas) está em e2e/filtros/explorar.spec.ts.

type Plano = { id: string; name: string }

const nomesNoExplorar = async (page: Page, plano: string) => {
  await page.goto(`/explorar?plans=${encodeURIComponent(plano)}`)
  await expect(page.getByText(/^\d+ veterinários? encontrad[oa]s?$|Nenhum veterinário encontrado/).first()).toBeVisible()
  return page.locator('[class*="veterinarioCard"] h3').allInnerTexts()
}

test.describe('planos de saúde pela tela', () => {
  test.use({ storageState: sessao('veterinario2') })

  test('vet marca um plano no perfil, a busca e a página pública refletem; desmarcar volta ao original', async ({ page, browser }) => {
    test.setTimeout(3 * 60_000)
    const vetId = await idVeterinario('veterinario2')
    const [vet] = await consultar<{ nome: string }>(
      `select u.nome || ' ' || u.sobrenome as nome from veterinarios v join users u on u.id = v.user_id where v.id = $1`,
      [vetId]
    )
    const [novo] = await consultar<Plano>(
      `select p.id, p.name from planos p
       where not exists (select 1 from veterinario_planos vp where vp.plano_id = p.id and vp.veterinario_id = $1)
       order by p.name limit 1`,
      [vetId]
    )
    test.skip(!novo, 'Vet já aceita todos os planos')

    const visitanteCtx = await browser.newContext({ storageState: SEM_SESSAO })
    const visitante = await visitanteCtx.newPage()
    expect(await nomesNoExplorar(visitante, novo.name)).not.toContain(vet.nome)

    const alternarPlano = async () => {
      await page.goto('/dashboard/veterinario/perfil')
      const secao = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Planos de Saúde Aceitos' }) }).last()
      await secao.getByRole('button', { name: novo.name, exact: true }).click()
      await page.getByRole('button', { name: 'Salvar Informações' }).click()
      await expect(page.getByRole('button', { name: 'Salvar Informações' })).toBeEnabled()
    }

    try {
      await alternarPlano()
      await expect
        .poll(async () => (await consultar(`select 1 from veterinario_planos where veterinario_id = $1 and plano_id = $2`, [vetId, novo.id])).length)
        .toBe(1)

      expect(await nomesNoExplorar(visitante, novo.name)).toContain(vet.nome)
      await visitante.goto(`/veterinario/${vetId}`)
      const secao = visitante.locator('section').filter({ has: visitante.getByRole('heading', { name: 'Planos de Saúde Atendidos' }) })
      await expect(secao.getByText(novo.name, { exact: true })).toBeVisible()
    } finally {
      await alternarPlano()
      await expect
        .poll(async () => (await consultar(`select 1 from veterinario_planos where veterinario_id = $1 and plano_id = $2`, [vetId, novo.id])).length)
        .toBe(0)
    }
    expect(await nomesNoExplorar(visitante, novo.name)).not.toContain(vet.nome)
    await visitanteCtx.close()
  })
})

test.describe('planos no perfil público', () => {
  test.use({ storageState: SEM_SESSAO })

  test('página do vet lista os planos aceitos', async ({ page }) => {
    const vetId = await idVeterinario('veterinario')
    const planos = await consultar<{ name: string }>(
      `select p.name from planos p join veterinario_planos vp on vp.plano_id = p.id where vp.veterinario_id = $1`,
      [vetId]
    )
    await page.goto(`/veterinario/${vetId}`)
    const secao = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Planos de Saúde Atendidos' }) })
    await expect(secao).toBeVisible()
    if (!planos.length) {
      await expect(secao).toContainText('Nenhum plano de saúde informado ainda.')
      return
    }
    for (const p of planos) await expect(secao.getByText(p.name, { exact: true })).toBeVisible()
  })
})
