import { test, expect, type Page, type Route } from '@playwright/test'

const grade = Object.fromEntries(['domingo','segunda','terca','quarta','quinta','sexta','sabado'].map(dia => [dia,['19:00','20:00']]))
const livre = { horarios_ocupados: [], dia_bloqueado: false }
const bloqueada = { horarios_ocupados: ['19:00','20:00'], dia_bloqueado: true }

async function entregar(page: Page, route: Route, falha: boolean, dados = bloqueada) {
  const recebida = page.waitForResponse(r => r.url() === route.request().url())
  await route.fulfill(falha ? { status:500,json:{message:'Falha controlada'} } : { json:dados })
  await (await recebida).finished()
  // Dá ao React a oportunidade de aplicar a resposta; verificar antes disso esconderia a regressão.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}

async function preparar(page: Page, porData = false, segurarAtual = false) {
  let antiga: Route | undefined, atual: Route | undefined
  let dataAntiga: string | null = null
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), p = url.pathname
    if (p === '/api/auth/me') return route.fulfill({ json: { user: { id:'tutor',nome:'Teste',userType:'tutor',onboardingComplete:1 } } })
    if (p === '/api/veterinarios/teste-concorrencia') return route.fulfill({ json: { veterinario: {
      id:'teste-concorrencia',nome:'Veterinário de teste',cidade:'Recife',estado:'PE',endereco:'Rua de teste',crmv:'12345-PE',bio:'Teste de disponibilidade',rating:0,totalReviews:0,preco:150,
      especialidades:['Clínica Geral'],atendeOnline:true,precoConsultaOnline:120,horariosOnline:grade,availability:grade,crmvAprovado:true,limitReached:false,
      locations:[{id:'local-1',nomeClinica:'Consultório de teste',cidade:'Recife',estado:'PE',endereco:'Rua de teste',fullAddress:'Rua de teste',preco:150,availability:grade,isPrimary:true}],
    } } })
    if (p.includes('/agendamentos/disponibilidade/')) {
      const online = url.searchParams.get('tipo_consulta') === 'online'
      if (porData && online && dataAntiga === null) dataAntiga = url.searchParams.get('data')
      const ehAntiga = porData ? online && url.searchParams.get('data') === dataAntiga : url.searchParams.get('endereco_id') === 'local-1'
      if (ehAntiga && !antiga) { antiga=route; return }
      if (online && segurarAtual && !ehAntiga && !atual) { atual=route; return }
      return route.fulfill({ json: livre })
    }
    if (p.includes('/avaliacoes')) return route.fulfill({json:{avaliacoes:[],media:0,total:0}})
    return route.fulfill({json:{data:[],isFavorited:false,count:0}})
  })
  await page.goto('/veterinario/teste-concorrencia')
  await expect(page.getByRole('heading',{name:'Agendar Consulta'})).toBeVisible()
  async function selecionar(texto:string) {
    await page.getByRole('button',{name:'Escolha um local'}).click()
    await page.getByRole('option').filter({hasText:texto}).click()
  }
  await selecionar(porData ? 'Teleconsulta' : 'Consultório de teste')
  await expect.poll(()=>!!antiga).toBe(true)
  if (porData) await page.locator('[class*="dateOption"]').nth(1).click()
  else await selecionar('Teleconsulta')
  if (segurarAtual) await expect.poll(()=>!!atual).toBe(true)
  return { antiga:()=>antiga!, atual:()=>atual! }
}

for (const porData of [false,true]) {
  for (const falha of [false,true]) {
    test(`troca de ${porData?'data':'local'} ignora ${falha?'erro':'bloqueio'} de resposta antiga`,async({page})=>{
      const requisicoes=await preparar(page,porData)
      const horario=page.getByRole('button',{name:'19:00',exact:true})
      await expect(horario).toBeEnabled()
      await horario.click()
      const agendar=page.getByRole('button',{name:'Agendar',exact:true})
      await expect(agendar).toBeEnabled()
      await entregar(page,requisicoes.antiga(),falha)
      await expect(horario).toBeEnabled()
      await expect(agendar).toBeEnabled()
      await expect(page.getByText('Não foi possível consultar a agenda.',{exact:false})).toHaveCount(0)
    })
  }
}

test('resposta antiga não encerra o carregamento da seleção atual',async({page})=>{
  const requisicoes=await preparar(page,false,true)
  await expect(page.locator('[class*="timeSlots"]')).toContainText('Carregando...')
  await entregar(page,requisicoes.antiga(),false)
  await expect(page.locator('[class*="timeSlots"]')).toContainText('Carregando...')
  await expect(page.getByRole('button',{name:'Agendar',exact:true})).toBeDisabled()
  await entregar(page,requisicoes.atual(),false,livre)
  await expect(page.getByRole('button',{name:'19:00',exact:true})).toBeEnabled()
})

test('erro da seleção atual permanece mesmo quando resposta antiga tem sucesso',async({page})=>{
  const requisicoes=await preparar(page,false,true)
  await entregar(page,requisicoes.atual(),true)
  const erro=page.getByText('Não foi possível consultar a agenda.',{exact:false})
  await expect(erro).toBeVisible()
  await entregar(page,requisicoes.antiga(),false,livre)
  await expect(erro).toBeVisible()
  await expect(page.getByRole('button',{name:'Agendar',exact:true})).toBeDisabled()
})
