import { randomUUID } from 'node:crypto'
import { request as pwRequest, type Browser, type Page } from '@playwright/test'
import { abrirMenuDaConta, expect, SEM_SESSAO, sessao, test, type Perfil } from '../fixtures'
import { apiComo, dataFutura, idClinica, idVeterinario, petsDoTutor } from '../agenda'
import { consultar } from '../db'

async function janela(browser: Browser, perfil: Perfil) {
  const ctx = await browser.newContext({ storageState: sessao(perfil) })
  return { ctx, page: await ctx.newPage() }
}

const crmvAleatorio = () => `${100000 + Math.floor(Math.random() * 899999)}-SP`

async function abrirAprovacoes(page: Page) {
  const resposta = page.waitForResponse((r) => r.url().endsWith('/api/admin/aprovacoes') && r.request().method() === 'GET')
  await page.goto('/admin/aprovacoes')
  expect((await resposta).status()).toBe(200)
}

const filaCrmv = (page: Page) => page.getByRole('region', { name: 'CRMV de veterinários' })
const filaRt = (page: Page) => page.getByRole('region', { name: 'RT de clínicas' })

async function reprovar(page: Page, pedido: ReturnType<Page['getByRole']>, motivo: string) {
  await pedido.getByRole('button', { name: 'Reprovar' }).click()
  const confirmar = pedido.getByRole('button', { name: 'Confirmar reprovação' })
  await expect(confirmar, 'sem motivo não confirma').toBeDisabled()
  await pedido.getByLabel('Motivo da reprovação').fill('   ')
  await expect(confirmar, 'só espaços não contam como motivo').toBeDisabled()
  await pedido.getByLabel('Motivo da reprovação').fill(motivo)
  await confirmar.click()
  await expect(page.getByRole('status')).toHaveText('Reprovado. O usuário foi avisado.')
  await expect(pedido, 'sai da fila depois da decisão').toHaveCount(0)
}

async function verNotificacao(page: Page, titulo: string, motivo: string) {
  await page.getByRole('banner').getByRole('button', { name: /^Notificações/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Notificações', level: 3 })).toBeVisible()
  const aviso = page.getByText(titulo, { exact: true }).first()
  await expect(aviso).toBeVisible()
  await expect(page.getByText(`Motivo: ${motivo}`).first()).toBeVisible()
}

test.describe('painel admin de aprovações', () => {
  test('só o admin entra no painel e decide; visitante e tutor são barrados', async ({ browser }) => {
    const vetId = await idVeterinario('veterinario2')
    const clinicaId = await idClinica()

    await test.step('visitante: a API pede login', async () => {
      const visitante = await pwRequest.newContext({ baseURL: 'http://localhost:3000', storageState: SEM_SESSAO })
      expect((await visitante.get('/api/admin/aprovacoes')).status()).toBe(401)
      expect((await visitante.post(`/api/admin/aprovacoes/veterinarios/${vetId}`, { data: { decisao: 'aprovar' } })).status()).toBe(401)
      await visitante.dispose()
    })

    await test.step('tutor comum: tela restrita, sem link de admin e API proibida', async () => {
      const tutor = await janela(browser, 'tutor')
      await tutor.page.goto('/admin/aprovacoes')
      await expect(tutor.page.getByText('Esta área é restrita ao administrador da Lince Pet.')).toBeVisible()
      await abrirMenuDaConta(tutor.page)
      await expect(tutor.page.getByRole('link', { name: 'Admin' })).toHaveCount(0)

      const api = await apiComo('tutor')
      expect((await api.get('/api/admin/aprovacoes')).status()).toBe(403)
      expect((await api.post(`/api/admin/aprovacoes/veterinarios/${vetId}`, { data: { decisao: 'aprovar' } })).status()).toBe(403)
      expect((await api.post(`/api/admin/aprovacoes/clinicas/${clinicaId}`, { data: { decisao: 'aprovar' } })).status()).toBe(403)
      await api.dispose()
      await tutor.ctx.close()
    })

    await test.step('admin: chega ao painel pelo menu da conta', async () => {
      const admin = await janela(browser, 'admin')
      await admin.page.goto('/dashboard/tutor')
      await abrirMenuDaConta(admin.page)
      await admin.page.getByRole('link', { name: 'Admin' }).first().click()
      await expect(admin.page).toHaveURL('/admin/dashboard')
      await admin.page.getByRole('link', { name: 'Aprovações' }).click()
      await expect(admin.page).toHaveURL('/admin/aprovacoes')
      await expect(admin.page.getByRole('heading', { name: 'Aprovações', level: 1 })).toBeVisible()
      await expect(filaCrmv(admin.page)).toBeVisible()
      await expect(filaRt(admin.page)).toBeVisible()
      await admin.ctx.close()
    })
  })

  test('CRMV do veterinário: reprovar exige motivo, o vet vê o motivo, reenvia e o admin aprova', async ({ browser }) => {
    test.setTimeout(3 * 60_000)
    const vetId = await idVeterinario('veterinario2')
    const [original] = await consultar<{ crmv: string; crmv_status: string; crmv_motivo: string | null }>(
      `select crmv, crmv_status, crmv_motivo from veterinarios where id = $1`,
      [vetId]
    )
    const motivo = `CRMV não consta no conselho regional (${randomUUID().slice(0, 6)})`
    const vet = await janela(browser, 'veterinario2')
    const admin = await janela(browser, 'admin')
    const apiVet = await apiComo('veterinario2')
    const apiAdmin = await apiComo('admin')
    const apiTutor = await apiComo('tutor')

    try {
      const primeiro = crmvAleatorio()
      await test.step('vet envia um CRMV novo e fica em análise', async () => {
        const res = await apiVet.post('/api/onboarding/step1', { data: { crmv: primeiro } })
        expect(res.status(), await res.text()).toBe(200)
        await vet.page.goto('/dashboard/veterinario')
        await expect(vet.page.getByText('Seu CRMV está em análise pela equipe Lince Pet.')).toBeVisible()
        await expect(vet.page.getByText(/seu perfil não aparece na busca e não recebe agendamentos/)).toBeVisible()
      })

      await test.step('em análise, o vet não recebe agendamento', async () => {
        const [pet] = await petsDoTutor('tutor')
        const res = await apiTutor.post('/api/agendamentos', {
          data: { veterinario_id: vetId, pet_id: pet.id, data_consulta: dataFutura(), horario_consulta: '10:00', tipo_consulta: 'online' },
        })
        expect(res.status()).toBe(400)
        expect((await res.json()).message).toBe('Este profissional ainda não pode receber agendamentos: o CRMV está em análise.')
      })

      await test.step('admin reprova; sem motivo não passa, nem pela tela nem pela API', async () => {
        await abrirAprovacoes(admin.page)
        const pedido = filaCrmv(admin.page).getByRole('listitem').filter({ hasText: `CRMV ${primeiro} (SP)` })
        await expect(pedido).toBeVisible()

        const semMotivo = await apiAdmin.post(`/api/admin/aprovacoes/veterinarios/${vetId}`, { data: { decisao: 'reprovar', motivo: '  ' } })
        expect(semMotivo.status()).toBe(400)
        expect((await semMotivo.json()).message).toBe('Informe o motivo da reprovação')

        await reprovar(admin.page, pedido, motivo)
        await abrirAprovacoes(admin.page)
        await expect(filaCrmv(admin.page).getByRole('listitem').filter({ hasText: primeiro })).toHaveCount(0)

        const [linha] = await consultar<{ crmv_status: string; crmv_motivo: string }>(
          `select crmv_status, crmv_motivo from veterinarios where id = $1`,
          [vetId]
        )
        expect(linha).toEqual({ crmv_status: 'reprovado', crmv_motivo: motivo })
      })

      await test.step('decidir de novo o mesmo pedido responde 409', async () => {
        const res = await apiAdmin.post(`/api/admin/aprovacoes/veterinarios/${vetId}`, { data: { decisao: 'aprovar' } })
        expect(res.status()).toBe(409)
      })

      await test.step('vet vê a reprovação com o motivo no painel e no sino', async () => {
        await vet.page.goto('/dashboard/veterinario')
        await expect(vet.page.getByText('Seu CRMV foi reprovado.')).toBeVisible()
        await expect(vet.page.getByText(`Motivo: ${motivo}.`)).toBeVisible()
        await verNotificacao(vet.page, 'CRMV reprovado', motivo)
      })

      const corrigido = crmvAleatorio()
      await test.step('vet corrige o CRMV: volta para análise e o motivo antigo some', async () => {
        const res = await apiVet.post('/api/onboarding/step1', { data: { crmv: corrigido } })
        expect(res.status(), await res.text()).toBe(200)
        await vet.page.goto('/dashboard/veterinario')
        await expect(vet.page.getByText('Seu CRMV está em análise pela equipe Lince Pet.')).toBeVisible()
        await expect(vet.page.getByText(`Motivo: ${motivo}.`)).toHaveCount(0)
      })

      await test.step('admin aprova e o aviso some do painel do vet', async () => {
        await abrirAprovacoes(admin.page)
        const pedido = filaCrmv(admin.page).getByRole('listitem').filter({ hasText: `CRMV ${corrigido} (SP)` })
        await pedido.getByRole('button', { name: 'Aprovar' }).click()
        await expect(admin.page.getByRole('status')).toHaveText('Aprovado. O usuário foi avisado.')
        await expect(pedido).toHaveCount(0)

        const [linha] = await consultar<{ crmv_status: string; crmv_motivo: string | null }>(
          `select crmv_status, crmv_motivo from veterinarios where id = $1`,
          [vetId]
        )
        expect(linha).toEqual({ crmv_status: 'aprovado', crmv_motivo: null })

        await vet.page.goto('/dashboard/veterinario')
        await expect(vet.page.getByText(/Seu CRMV (está em análise|foi reprovado)/)).toHaveCount(0)
        await vet.page.getByRole('banner').getByRole('button', { name: /^Notificações/ }).first().click()
        await expect(vet.page.getByText('CRMV aprovado', { exact: true }).first()).toBeVisible()
      })
    } finally {
      await consultar(`update veterinarios set crmv = $2, crmv_status = $3, crmv_motivo = $4 where id = $1`, [
        vetId,
        original.crmv,
        original.crmv_status,
        original.crmv_motivo,
      ])
      await Promise.all([apiVet.dispose(), apiAdmin.dispose(), apiTutor.dispose(), vet.ctx.close(), admin.ctx.close()])
    }
  })

  test('RT da clínica: reprovar com motivo, a clínica vê o motivo, reenvia e o admin aprova', async ({ browser }) => {
    test.setTimeout(3 * 60_000)
    const clinicaId = await idClinica()
    const [original] = await consultar<{
      nome_clinica: string
      exames_ativo: number
      rt_nome: string | null
      rt_crmv: string | null
      rt_status: string | null
      rt_motivo: string | null
    }>(`select nome_clinica, exames_ativo, rt_nome, rt_crmv, rt_status, rt_motivo from clinicas where id = $1`, [clinicaId])
    const marca = randomUUID().slice(0, 6)
    const motivo = `RT sem vínculo com a clínica (${marca})`
    const clinica = await janela(browser, 'clinica')
    const admin = await janela(browser, 'admin')
    const secaoRt = () => clinica.page.getByRole('region', { name: 'Responsável técnico' })

    async function enviarRt(nome: string, crmv: string) {
      await clinica.page.goto('/dashboard/clinica/exames')
      const modulo = clinica.page.getByLabel('Receber agendamentos de exames')
      await expect(modulo).toBeVisible()
      if (!(await modulo.isChecked())) await modulo.click()
      await expect(modulo).toBeChecked()
      await secaoRt().getByLabel('Nome do responsável técnico').fill(nome)
      await secaoRt().getByLabel('CRMV do responsável técnico').fill(crmv)
      await secaoRt().getByRole('button', { name: 'Enviar para análise' }).click()
      await expect(secaoRt().getByText('Enviado para análise da equipe Lince Pet.')).toBeVisible()
      await expect(secaoRt().getByText('O responsável técnico está em análise pela equipe Lince Pet.')).toBeVisible()
    }

    try {
      const primeiro = crmvAleatorio()
      await test.step('clínica envia o RT e fica em análise', async () => {
        await enviarRt(`Dr. RT ${marca}`, primeiro)
      })

      await test.step('admin reprova o RT com motivo', async () => {
        await abrirAprovacoes(admin.page)
        const pedido = filaRt(admin.page).getByRole('listitem', { name: original.nome_clinica })
        await expect(pedido).toContainText(`RT: Dr. RT ${marca} - CRMV ${primeiro} (SP)`)
        await reprovar(admin.page, pedido, motivo)
      })

      await test.step('clínica vê a reprovação com o motivo na tela de exames e no sino', async () => {
        await clinica.page.goto('/dashboard/clinica/exames')
        await expect(secaoRt().getByText('O responsável técnico foi reprovado.')).toBeVisible()
        await expect(secaoRt().getByText(`Motivo: ${motivo}.`)).toBeVisible()
        await verNotificacao(clinica.page, 'Responsável técnico reprovado', motivo)
      })

      const corrigido = crmvAleatorio()
      await test.step('clínica corrige o RT e volta para análise', async () => {
        await enviarRt(`Dra. RT ${marca}`, corrigido)
        await expect(secaoRt().getByText(`Motivo: ${motivo}.`)).toHaveCount(0)
      })

      await test.step('admin aprova e a clínica vê o RT aprovado', async () => {
        await abrirAprovacoes(admin.page)
        const pedido = filaRt(admin.page).getByRole('listitem', { name: original.nome_clinica })
        await expect(pedido).toContainText(`CRMV ${corrigido} (SP)`)
        await pedido.getByRole('button', { name: 'Aprovar' }).click()
        await expect(admin.page.getByRole('status')).toHaveText('Aprovado. O usuário foi avisado.')

        await clinica.page.goto('/dashboard/clinica/exames')
        await expect(secaoRt().getByText('Responsável técnico aprovado.')).toBeVisible()
        await expect(secaoRt().getByText(/está em análise|foi reprovado/)).toHaveCount(0)
      })
    } finally {
      await consultar(
        `update clinicas set exames_ativo = $2, rt_nome = $3, rt_crmv = $4, rt_status = $5, rt_motivo = $6 where id = $1`,
        [clinicaId, original.exames_ativo, original.rt_nome, original.rt_crmv, original.rt_status, original.rt_motivo]
      )
      await Promise.all([clinica.ctx.close(), admin.ctx.close()])
    }
  })
})
