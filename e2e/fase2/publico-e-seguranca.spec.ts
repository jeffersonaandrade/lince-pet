import type { Page } from '@playwright/test'
import { expect, SEM_SESSAO, sessao, test } from '../fixtures'
import { apiComo, idClinica, idVeterinario, petsDoTutor } from '../agenda'
import { consultar } from '../db'

const PROIBIDOS_EM_JSON = ['"password"', '"senha"', '"token_version"', '"tokenVersion"', '"start_code"', '"startCode"']

async function dadosPrivadosDoVet(email: string) {
  const [linha] = await consultar<{ cpf: string | null; cnpj: string | null; email: string; celular: string | null }>(
    `select v.cpf, v.cnpj, u.email, u.celular from veterinarios v join users u on u.id = v.user_id where u.email = $1`,
    [email]
  )
  return [linha.cpf, linha.cnpj, linha.email, linha.celular].filter((v): v is string => Boolean(v))
}

/** Abre a página como um visitante e junta tudo que o navegador recebeu da API durante o carregamento. */
async function abrirEColetarApi(page: Page, rota: string) {
  const respostas: { url: string; status: number; corpo: string }[] = []
  page.on('response', async (res) => {
    if (!res.url().includes('/api/')) return
    respostas.push({ url: res.url(), status: res.status(), corpo: await res.text().catch(() => '') })
  })
  await page.goto(rota)
  await page.waitForLoadState('networkidle')
  return respostas
}

test.describe('perfil público sem dados privados (visitante pela tela)', () => {
  test.use({ storageState: SEM_SESSAO })

  test('página do veterinário: nem a tela nem as respostas da API trazem CPF, CNPJ, e-mail, celular ou segredos', async ({ page }) => {
    const respostas = await abrirEColetarApi(page, `/veterinario/${await idVeterinario('veterinario')}`)
    await expect(page.getByRole('heading', { name: 'Agendar Consulta' })).toBeVisible()
    expect(respostas.some((r) => r.url.includes('/api/veterinarios/')), 'a página buscou o perfil na API').toBe(true)

    const privados = await dadosPrivadosDoVet('dra.fernanda.mockup@vetclinic.com')
    const html = await page.content()
    for (const valor of privados) expect(html).not.toContain(valor)
    for (const r of respostas) {
      for (const valor of privados) expect(r.corpo, r.url).not.toContain(valor)
      for (const chave of PROIBIDOS_EM_JSON) expect(r.corpo, r.url).not.toContain(chave)
    }
  })

  test('página da clínica: e-mail do dono e documentos dos vets da equipe não chegam ao navegador', async ({ page }) => {
    const id = await idClinica()
    const respostas = await abrirEColetarApi(page, `/clinicas/${id}`)
    const daClinica = respostas.find((r) => r.url.includes(`/api/clinicas/${id}`))
    expect(daClinica, 'a página buscou a clínica na API').toBeTruthy()

    const [dono] = await consultar<{ email: string }>(`select u.email from clinicas c join users u on u.id = c.user_id where c.id = $1`, [id])
    const equipe = await consultar<{ cpf: string | null; email: string }>(
      `select v.cpf, u.email from veterinario_clinicas vc join veterinarios v on v.id = vc.veterinario_id
       join users u on u.id = v.user_id where vc.clinica_id = $1`,
      [id]
    )
    const html = await page.content()
    for (const r of [...respostas.map((x) => x.corpo), html]) {
      expect(r).not.toContain(dono.email)
      for (const vet of equipe) {
        if (vet.cpf) expect(r).not.toContain(vet.cpf)
        expect(r).not.toContain(vet.email)
      }
      for (const chave of PROIBIDOS_EM_JSON) expect(r).not.toContain(chave)
    }
  })

  test('link com id inexistente não abre perfil', async ({ page }) => {
    const falso = '00000000-0000-4000-8000-000000000000'
    const vet = await abrirEColetarApi(page, `/veterinario/${falso}`)
    expect(vet.find((r) => r.url.includes(`/api/veterinarios/${falso}`))?.status).toBe(404)
    await expect(page.getByRole('heading', { name: 'Agendar Consulta' })).toHaveCount(0)

    const clinica = await abrirEColetarApi(page, `/clinicas/${falso}`)
    expect(clinica.find((r) => r.url.includes(`/api/clinicas/${falso}`))?.status).toBe(404)
  })
})

// A tela recorta e reconverte a foto em PNG antes de enviar, então arquivo inválido nunca sai dela;
// estes testes são só a defesa do servidor contra quem chama a rota direto.
test.describe('invasão (fora da tela): upload de foto', () => {
  test.use({ storageState: sessao('tutor') })

  test('recusa arquivo que não é imagem, arquivo acima do limite e pet de outro tutor', async () => {
    const api = await apiComo('tutor')
    const [pet] = await petsDoTutor('tutor')
    const [petAlheio] = await petsDoTutor('tutor2')

    const executavel = await api.post(`/api/pets/${pet.id}/photo`, {
      multipart: { photo: { name: 'virus.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ fake') } },
    })
    expect(executavel.status()).toBe(400)

    const grande = await api.post(`/api/pets/${pet.id}/photo`, {
      multipart: { photo: { name: 'grande.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(7 * 1024 * 1024, 1) } },
    })
    expect(grande.status()).toBe(413)

    const semArquivo = await api.post(`/api/pets/${pet.id}/photo`, { data: { photo: 'nada' } })
    expect(semArquivo.status()).toBe(400)

    const alheio = await api.post(`/api/pets/${petAlheio.id}/photo`, {
      multipart: { photo: { name: 'x.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') } },
    })
    expect(alheio.status()).toBe(404)
  })

  test('sem login, upload responde 401', async ({ playwright }) => {
    const anonimo = await playwright.request.newContext({ storageState: SEM_SESSAO })
    const [pet] = await petsDoTutor('tutor')
    const res = await anonimo.post(`/api/pets/${pet.id}/photo`, {
      multipart: { photo: { name: 'x.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') } },
    })
    expect(res.status(), await res.text()).toBe(401)
    await anonimo.dispose()
  })
})

test.describe('cabeçalhos de segurança no que o navegador abre', () => {
  test.use({ storageState: SEM_SESSAO })
  const ESPERADOS: Record<string, RegExp> = {
    'x-frame-options': /^DENY$/,
    'content-security-policy': /frame-ancestors 'none'/,
    'x-content-type-options': /^nosniff$/,
    'referrer-policy': /strict-origin-when-cross-origin/,
    'strict-transport-security': /max-age=\d+/,
    'permissions-policy': /camera=\(\)/,
  }

  for (const rota of ['/', '/login', '/api/auth/me', '/api/veterinarios']) {
    test(`presentes em ${rota}`, async ({ page }) => {
      const res = await page.goto(rota)
      const headers = await res!.allHeaders()
      for (const [nome, valor] of Object.entries(ESPERADOS)) expect(headers[nome], `${rota}: ${nome}`).toMatch(valor)
      expect(headers['x-powered-by']).toBeUndefined()
    })
  }
})
