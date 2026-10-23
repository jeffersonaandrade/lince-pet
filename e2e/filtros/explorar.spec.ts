import type { APIRequestContext, Page } from '@playwright/test'
import { expect, SEM_SESSAO, test } from '../fixtures'
import { consultar } from '../db'
import { clicavel } from '../responsivo/layout'

type Filtros = { search?: string; specialty?: string; location?: string; plans?: string }
type Item = { nome: string; nota: number; especialidades: string[] }

const comparar = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })

/** Ordenação padrão do /explorar: maior nota primeiro, empate por nome. */
const porNota = (lista: Item[]) =>
  lista.toSorted((a, b) => (a.nota === b.nota ? comparar(a.nome, b.nome) : b.nota - a.nota)).map((i) => i.nome)

/** Mesma conversão do /explorar: "Cidade, UF" vira cidade + estado. */
function paramsDaApi(f: Filtros) {
  const p = new URLSearchParams()
  if (f.search) p.set('search', f.search)
  if (f.specialty) p.set('especialidade', f.specialty)
  if (f.plans) p.set('plano', f.plans)
  if (f.location) {
    const [cidade, estado] = f.location.includes(',') ? f.location.split(',').map((s) => s.trim()) : [f.location, '']
    if (cidade) p.set('cidade', cidade)
    if (estado) p.set('estado', estado)
  }
  return p.toString()
}

/** O que a tela deve mostrar: resultado da API + o filtro local da página (busca só no nome, especialidade na lista). */
function filtroLocal(lista: Item[], f: Filtros) {
  const termo = f.search?.toLowerCase()
  const esp = f.specialty?.toLowerCase()
  return lista.filter(
    (i) => (!termo || i.nome.toLowerCase().includes(termo)) && (!esp || i.especialidades.some((e) => e.toLowerCase().includes(esp)))
  )
}

async function vetsEsperados(api: APIRequestContext, f: Filtros) {
  const res = await api.get(`/api/veterinarios/search?${paramsDaApi(f)}`)
  expect(res.status()).toBe(200)
  const vets = (await res.json()).veterinarios as { nome: string; rating: number; especialidades: string[] }[]
  return porNota(filtroLocal(vets.map((v) => ({ nome: v.nome, nota: Number(v.rating) || 0, especialidades: v.especialidades })), f))
}

async function clinicasEsperadas(api: APIRequestContext, f: Filtros) {
  const res = await api.get(`/api/clinicas?${paramsDaApi(f)}`)
  expect(res.status()).toBe(200)
  const clinicas = (await res.json()) as { nomeClinica: string; rating: number; especialidades: { nome: string }[] }[]
  return porNota(
    filtroLocal(
      clinicas.map((c) => ({ nome: c.nomeClinica, nota: Number(c.rating) || 0, especialidades: c.especialidades.map((e) => e.nome) })),
      f
    )
  )
}

const url = (f: Filtros & { tab?: string; ordem?: string; direcao?: string; tipo?: string }) => {
  const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][])
  const q = p.toString()
  return q ? `/explorar?${q}` : '/explorar'
}

/** Opções do Dropdown são divs num portal no fim do body (sem papel ARIA). */
const opcaoDaLista = (page: Page, texto: string) => page.locator('[class*="optionsListPortal"]').getByText(texto, { exact: true })

const nomesNaTela = (page: Page) => page.locator('[class*="veterinarioCard"] h3').allInnerTexts()
const contagem = (page: Page) => page.getByText(/^\d+ (veterinários?|clínicas?) encontrad[oa]s?$/)

/** Espera a busca terminar e compara nomes e ordem com o esperado. Lista vazia: confere o aviso de "nenhum". */
async function confere(page: Page, esperado: string[], vazio = 'Nenhum veterinário encontrado') {
  if (!esperado.length) {
    await expect(page.getByRole('heading', { name: vazio })).toBeVisible()
    await expect(page.locator('[class*="veterinarioCard"] h3').filter({ hasNotText: vazio })).toHaveCount(0)
    return
  }
  await expect.poll(() => nomesNaTela(page)).toEqual(esperado)
  await expect(contagem(page)).toHaveText(new RegExp(`^${esperado.length} `))
}

/** Nomes de vets do seed que atendem um critério, direto do banco (fonte independente da API). */
const vetsNoBanco = (onde: string, params: unknown[]) =>
  consultar<{ nome: string }>(
    `select u.nome || ' ' || u.sobrenome as nome from veterinarios v join users u on u.id = v.user_id where ${onde}`,
    params
  ).then((r) => r.map((l) => l.nome).sort(comparar))

test.use({ storageState: SEM_SESSAO, permissions: [] })

test.describe('/explorar: veterinários', () => {
  test('sem filtro lista todos os vets da busca pública, na ordem de maior nota', async ({ page, request }) => {
    await page.goto('/explorar')
    await confere(page, await vetsEsperados(request, {}))
  })

  test('nome, especialidade, cidade e plano filtram e batem com o banco', async ({ page, request }) => {
    const casos: { f: Filtros; banco: Promise<string[]> }[] = [
      {
        f: { search: 'Fernanda' },
        banco: vetsNoBanco(`u.nome || ' ' || u.sobrenome ilike $1`, ['%Fernanda%']),
      },
      {
        f: { specialty: 'Cardiologia Veterinária' },
        banco: vetsNoBanco(
          `exists (select 1 from especialidade_relacionamentos er join especialidades es on es.id = er.especialidade_id
                   where er.entidade_id = v.id and er.entidade_tipo = 'veterinario' and es.nome = $1)`,
          ['Cardiologia Veterinária']
        ),
      },
      {
        f: { location: 'São Paulo, SP' },
        banco: vetsNoBanco(
          `exists (select 1 from veterinario_enderecos e where e.veterinario_id = v.id and e.cidade ilike $1 and e.estado = 'SP')`,
          ['%São Paulo%']
        ),
      },
      {
        f: { plans: 'Porto Seguro Pet' },
        banco: vetsNoBanco(
          `exists (select 1 from veterinario_planos vp join planos p on p.id = vp.plano_id where vp.veterinario_id = v.id and p.name = $1)`,
          ['Porto Seguro Pet']
        ),
      },
    ]
    for (const { f, banco } of casos) {
      await test.step(JSON.stringify(f), async () => {
        const esperado = await vetsEsperados(request, f)
        expect(esperado.length, 'o seed precisa ter alguém para este filtro').toBeGreaterThan(0)
        expect(esperado.toSorted(comparar)).toEqual(await banco)
        await page.goto(url(f))
        await confere(page, esperado)
        if (f.location) await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Veterinários em ${f.location}`)
      })
    }
  })

  test('filtros combinados se somam (E) e combinação sem resultado mostra o vazio', async ({ page, request }) => {
    const f = { specialty: 'Clínica Médica', location: 'São Paulo, SP' }
    const esperado = await vetsEsperados(request, f)
    const banco = await vetsNoBanco(
      `exists (select 1 from veterinario_enderecos e where e.veterinario_id = v.id and e.cidade ilike '%São Paulo%' and e.estado = 'SP')
       and exists (select 1 from especialidade_relacionamentos er join especialidades es on es.id = er.especialidade_id
                   where er.entidade_id = v.id and er.entidade_tipo = 'veterinario' and es.nome ilike '%Clínica Médica%')`,
      []
    )
    expect(esperado.toSorted(comparar)).toEqual(banco)
    expect(esperado.length).toBeGreaterThan(0)
    await page.goto(url(f))
    await confere(page, esperado)

    await page.goto(url({ specialty: 'Cardiologia Veterinária', location: 'Salvador, BA' }))
    await confere(page, [])
  })

  test('sem resultado mostra o aviso e "Remover todos os filtros" volta para a lista completa', async ({ page, request }) => {
    await page.goto(url({ search: 'NinguemComEsseNome', location: 'São Paulo, SP' }))
    await confere(page, [])
    await page.getByRole('button', { name: 'Remover todos os filtros' }).first().click()
    await expect(page).toHaveURL(/\/explorar$/)
    await confere(page, await vetsEsperados(request, {}))
  })

  test('busca pela barra: digita, escolhe a especialidade na lista e envia', async ({ page, request }) => {
    await page.goto('/explorar')
    await expect(contagem(page)).toBeVisible()

    await page.getByRole('textbox', { name: 'Busca' }).fill('  Henrique  ')
    await page.getByRole('textbox', { name: 'Selecione a especialidade' }).click()
    await opcaoDaLista(page, 'Medicina Felina').click()
    await page.locator('form button[type="submit"]').click()

    await expect(page).toHaveURL(/search=Henrique&specialty=Medicina\+Felina$/)
    await confere(page, await vetsEsperados(request, { search: 'Henrique', specialty: 'Medicina Felina' }))
    await expect(page.getByRole('textbox', { name: 'Busca' })).toHaveValue('Henrique')
  })
})

test.describe('/explorar: clínicas', () => {
  test('cidade, plano e nome filtram clínicas e batem com o banco', async ({ page, request }) => {
    const casos: { f: Filtros; banco: string[] }[] = [
      {
        f: { location: 'São Paulo, SP' },
        banco: (await consultar<{ n: string }>(`select nome_clinica n from clinicas where cidade ilike '%São Paulo%' and estado = 'SP'`)).map((r) => r.n),
      },
      {
        f: { plans: 'Eupet' },
        banco: (
          await consultar<{ n: string }>(
            `select c.nome_clinica n from clinicas c where exists (select 1 from clinica_planos cp join planos p on p.id = cp.plano_id
             where cp.clinica_id = c.id and p.name = 'Eupet')`
          )
        ).map((r) => r.n),
      },
      {
        f: { search: 'Vila Animal' },
        banco: (await consultar<{ n: string }>(`select nome_clinica n from clinicas where nome_clinica ilike '%Vila Animal%'`)).map((r) => r.n),
      },
    ]
    for (const { f, banco } of casos) {
      await test.step(JSON.stringify(f), async () => {
        const esperado = await clinicasEsperadas(request, f)
        expect(esperado.length, 'o seed precisa ter alguma clínica para este filtro').toBeGreaterThan(0)
        expect(esperado.toSorted(comparar)).toEqual(banco.sort(comparar))
        await page.goto(url({ ...f, tab: 'clinicas' }))
        await confere(page, esperado, 'Nenhuma clínica encontrada')
      })
    }
    await page.goto(url({ tab: 'clinicas', location: 'Manaus, AM' }))
    await confere(page, [], 'Nenhuma clínica encontrada')
  })
})

test.describe('/explorar: profissionais pet', () => {
  test('tipo de serviço e cidade filtram os prestadores', async ({ page, request }) => {
    const esperados = async (q: string) => {
      const res = await request.get(`/api/prestadores/search?${q}`)
      expect(res.status()).toBe(200)
      return ((await res.json()).data as { nome: string; nota_media: number | null }[])
        .map((p) => ({ nome: p.nome, nota: p.nota_media ?? 0, especialidades: [] }))
    }
    const nomes = () => page.locator('section h3').filter({ hasNotText: 'Nenhum profissional encontrado' }).allInnerTexts()

    await page.goto(url({ tab: 'profissionais', location: 'São Paulo, SP' }))
    const emSp = porNota(await esperados('cidade=São Paulo&estado=SP'))
    expect(emSp.length).toBeGreaterThan(0)
    await expect.poll(nomes).toEqual(emSp)

    await page.getByRole('group', { name: 'Tipo de serviço' }).getByRole('button', { name: 'Passeador' }).click()
    await expect(page).toHaveURL(/tipo=passeador/)
    await expect(page).toHaveURL(/location=S%C3%A3o\+Paulo%2C\+SP/)
    const passeadorSp = porNota(await esperados('tipo=passeador&cidade=São Paulo&estado=SP'))
    if (passeadorSp.length) await expect.poll(nomes).toEqual(passeadorSp)
    else await expect(page.getByRole('heading', { name: 'Nenhum profissional encontrado' })).toBeVisible()

    await page.getByRole('group', { name: 'Tipo de serviço' }).getByRole('button', { name: 'Todos' }).click()
    await expect(page).not.toHaveURL(/tipo=/)
    await expect.poll(nomes).toEqual(emSp)
  })
})

test.describe('/explorar: URL e navegação', () => {
  test('troca de aba mantém os filtros e o voltar do navegador restaura a busca anterior', async ({ page, request }) => {
    const f = { location: 'São Paulo, SP' }
    await page.goto(url(f))
    await confere(page, await vetsEsperados(request, f))

    await page.getByRole('button', { name: 'Clínicas', exact: true }).click()
    await expect(page).toHaveURL(/tab=clinicas/)
    await expect(page).toHaveURL(/location=S%C3%A3o\+Paulo%2C\+SP/)
    await confere(page, await clinicasEsperadas(request, f), 'Nenhuma clínica encontrada')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Clínicas em São Paulo, SP')

    await page.getByRole('button', { name: 'Veterinários', exact: true }).click()
    await expect(page).toHaveURL(/tab=veterinarios/)

    await page.getByRole('textbox', { name: 'Busca' }).fill('Fernanda')
    await page.locator('form button[type="submit"]').click()
    await expect(page).toHaveURL(/search=Fernanda/)
    await expect(page).toHaveURL(/tab=veterinarios/)
    await confere(page, await vetsEsperados(request, { ...f, search: 'Fernanda' }))

    await page.goBack()
    await expect(page).not.toHaveURL(/search=/)
    await confere(page, await vetsEsperados(request, f))
    await expect(page.getByRole('textbox', { name: 'Busca' })).toHaveValue('')
  })

  test('ordenação: nome A–Z/Z–A e nota maior/menor; o padrão tira os parâmetros da URL', async ({ page, request }) => {
    const vets = await (await request.get('/api/veterinarios/search')).json()
    const itens: Item[] = vets.veterinarios.map((v: { nome: string; rating: number }) => ({ nome: v.nome, nota: Number(v.rating) || 0, especialidades: [] }))
    const ordemNome = itens.map((i) => i.nome).sort(comparar)
    const ordemNota = (fator: 1 | -1) =>
      itens.toSorted((a, b) => (a.nota === b.nota ? comparar(a.nome, b.nome) : (a.nota - b.nota) * fator)).map((i) => i.nome)

    await page.goto('/explorar')
    await confere(page, ordemNota(-1))

    const escolher = async (rotulo: string) => {
      await page.getByRole('button', { name: /^Ordenar lista/ }).click()
      await page.getByRole('menuitemradio', { name: rotulo }).click()
    }

    await escolher('Nome (A–Z)')
    await expect(page).toHaveURL(/ordem=nome&direcao=asc/)
    await expect.poll(() => nomesNaTela(page)).toEqual(ordemNome)
    await expect(page.getByRole('button', { name: 'Ordenar lista, Nome (A–Z)' })).toBeVisible()

    await escolher('Nome (Z–A)')
    await expect(page).toHaveURL(/ordem=nome&direcao=desc/)
    await expect.poll(() => nomesNaTela(page)).toEqual(ordemNome.toReversed())

    await escolher('Menor nota')
    await expect(page).toHaveURL(/ordem=nota&direcao=asc/)
    await expect.poll(() => nomesNaTela(page)).toEqual(ordemNota(1))

    await escolher('Maior nota')
    await expect(page).toHaveURL(/\/explorar$/)
    await expect.poll(() => nomesNaTela(page)).toEqual(ordemNota(-1))

    await page.getByRole('button', { name: /^Ordenar lista/ }).click()
    await expect(page.getByRole('menuitemradio', { name: 'Maior nota' })).toHaveAttribute('aria-checked', 'true')
  })

  test('ordenação junto com filtro: a ordem fica na URL ao enviar uma nova busca', async ({ page, request }) => {
    await page.goto(url({ ordem: 'nome', direcao: 'desc' }))
    await page.getByRole('textbox', { name: 'Busca' }).fill('a')
    await page.locator('form button[type="submit"]').click()
    await expect(page).toHaveURL(/ordem=nome&direcao=desc&search=a$/)
    const esperado = (await vetsEsperados(request, { search: 'a' })).sort(comparar).reverse()
    await expect.poll(() => nomesNaTela(page)).toEqual(esperado)
  })
})

test.describe('/explorar: entradas difíceis', () => {
  test('maiúsculas/minúsculas e espaços em volta do "Cidade, UF" não mudam o resultado', async ({ page, request }) => {
    const esperado = await vetsEsperados(request, { location: 'São Paulo, SP' })
    for (const location of ['são paulo, SP', 'SÃO PAULO,SP', '  São Paulo ,  SP ']) {
      await test.step(location, async () => {
        await page.goto(url({ location }))
        await confere(page, esperado)
      })
    }
  })

  test('caracteres especiais e SQL na busca não quebram a página', async ({ page }) => {
    const erros: string[] = []
    page.on('pageerror', (e) => erros.push(e.message))
    page.on('dialog', (d) => {
      erros.push(`dialog: ${d.message()}`)
      void d.dismiss()
    })
    for (const search of ['%', '_', "'; drop table users; --", '<script>alert(1)</script>', 'Ã©ç😀']) {
      await test.step(search, async () => {
        await page.goto(url({ search }))
        await confere(page, [])
        await expect(page.getByText('Ops! Algo deu errado')).toHaveCount(0)
        expect(erros).toEqual([])
      })
    }
  })

  test('parâmetros inválidos caem no padrão (aba veterinários, maior nota)', async ({ page, request }) => {
    await page.goto('/explorar?tab=xyz&ordem=preco&direcao=lado')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Explorar Veterinários')
    await confere(page, await vetsEsperados(request, {}))
    await expect(page.getByRole('button', { name: 'Ordenar lista, Maior nota' })).toBeVisible()
  })

  // Achados conhecidos: o filtro usa ILIKE e a UF por igualdade exata. Quando for corrigido, estes testes passam a falhar e o `test.fail` deve sair.
  test('UF minúscula encontra a cidade (hoje falha: estado comparado com =)', async ({ page, request }) => {
    test.fail()
    await page.goto(url({ location: 'São Paulo, sp' }))
    await confere(page, await vetsEsperados(request, { location: 'São Paulo, SP' }))
  })

  test('cidade sem acento encontra a cidade com acento (hoje falha: ILIKE sensível a acento)', async ({ page, request }) => {
    test.fail()
    await page.goto(url({ location: 'Sao Paulo, SP' }))
    await confere(page, await vetsEsperados(request, { location: 'São Paulo, SP' }))
  })
})

test.describe('/explorar no celular (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('lista de especialidades abre, a opção é clicável e a busca funciona sem rolagem lateral', async ({ page, request }) => {
    await page.goto('/explorar')
    await expect(contagem(page)).toBeVisible()

    await page.getByRole('textbox', { name: 'Selecione a especialidade' }).click()
    const opcao = opcaoDaLista(page, 'Cardiologia Veterinária')
    await clicavel(opcao)
    await opcao.click()
    await expect(page.getByRole('textbox', { name: 'Selecione a especialidade' })).toHaveValue('Cardiologia Veterinária')

    await page.locator('form button[type="submit"]').click()
    await expect(page).toHaveURL(/specialty=Cardiologia\+Veterin%C3%A1ria/)
    await confere(page, await vetsEsperados(request, { specialty: 'Cardiologia Veterinária' }))

    const larguras = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, tela: window.innerWidth }))
    expect(larguras.doc).toBeLessThanOrEqual(larguras.tela + 1)
  })
})
