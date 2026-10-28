import { test, expect, type BrowserContext } from '@playwright/test'

const free = { id:'free',code:'free',name:'Gratuito',priceCents:0,trialDays:0 }
const pro = { id:'vet-pro',code:'vet_pro',name:'Vet Pro',priceCents:5990,trialDays:0 }
const invoice = 'https://sandbox.asaas.com/i/TESTE_SEM_COBRANCA'

async function preparar(context: BrowserContext, opc: { pendente?: boolean; pago?: boolean; falha?: boolean; papel?: string; incompleto?: boolean; erroStatus?: boolean } = {}) {
  const estado = { pendente: opc.pendente || false, pago: opc.pago || false, cria: 0, prepara: 0, consultas: 0, falha: opc.falha || false, erroStatus: opc.erroStatus || false }
  const userType = opc.papel || 'veterinario'
  await context.route('**/api/**', async route => {
    const {pathname:p} = new URL(route.request().url())
    if (p === '/api/auth/me') return route.fulfill({json:{user:{id:'teste-pagamento',nome:'Equipe de teste',userType,onboardingComplete:opc.incompleto ? 0 : 1}}})
    if (p === '/api/assinaturas/planos') return route.fulfill({json:{plans:[free,pro]}})
    if (p === '/api/planos') return route.fulfill({json:[]})
    if (p === '/api/assinaturas/status') {
      estado.consultas++
      if (estado.erroStatus) return route.fulfill({status:503,json:{message:'Falha controlada'}})
      return route.fulfill({json:{plan:estado.pago ? pro : free,usage:{used:0,limit:estado.pago ? null : 5}, subscription:estado.pendente||estado.pago ? {id:'assinatura-teste',status:estado.pago ? 'active' : 'pending',trialEnd:null,asaasSubscriptionId:'sub_TESTE'} : null,statusLabel:estado.pago?'ativa':estado.pendente?'pendente':null,emTeste:false,trialEnd:null,testeDisponivel:false,pendingPlanId:null,checkoutUrl:estado.pendente&&!estado.pago?invoice:null,cancelamentoPendente:false,cancelamentoSolicitado:false}})
    }
    if (p === '/api/assinaturas' && route.request().method()==='POST') {
      estado.cria++; estado.pendente=true
      return route.fulfill({json:{subscription:{id:'assinatura-teste'},checkoutUrl:invoice,emTeste:false,primeiraFatura:'2026-10-27'}})
    }
    if (p === '/api/assinaturas/checkout' && route.request().method()==='POST') {
      estado.prepara++
      return route.fulfill(estado.falha ? {status:502,json:{message:'Falha controlada'}} : {json:{checkoutUrl:invoice}})
    }
    if (route.request().method()!=='GET') throw new Error(`Mutação inesperada: ${p}`)
    if (p === '/api/onboarding/progress') return route.fulfill({json:opc.incompleto ? {success:true,data:{currentStep:1,veterinario:{id:'teste'}}} : {currentStep:8,veterinario:{id:'teste',planos:[]}}})
    if (p === '/api/prestadores/perfil') return route.fulfill({json:{data:{id:'teste',tipo_servico:{nome:'Profissional pet',modalidade:'duracao'},endereco:{},onboarding_step:1,onboarding_complete:false,servicos:[],horarios:{}}}})
    return route.fulfill({json:{data:[],agendamentos:[],notificacoes:[],bloqueios:[]}})
  })
  await context.route('https://sandbox.asaas.com/**', route => route.fulfill({contentType:'text/html',body:'<h1>Destino de teste do pagamento</h1><p>Nenhuma cobrança real foi criada.</p>'}))
  return estado
}

test('contratação mantém a LincePet e abre o Asaas em outra aba pelo clique', async ({page,context}, info) => {
  const estado = await preparar(context)
  await page.goto('/dashboard/veterinario/alterar-plano')
  await page.getByText('Vet Pro',{exact:true}).first().click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button',{name:/Confirmar Vet Pro/}).click()
  const link = page.getByRole('link',{name:'Ir para pagamento no Asaas'})
  await expect(link).toBeVisible()
  await expect(page).toHaveURL(/\/dashboard\/veterinario\/alterar-plano$/)
  await expect(link).toHaveAttribute('target','_blank')
  await expect(page.getByRole('button',{name:/Confirmar Vet Pro/})).toBeDisabled()
  await link.scrollIntoViewIfNeeded()
  await page.screenshot({path:`.playwright-mcp/pagamentos/${info.project.name}/01-cobranca-pronta.png`,fullPage:true})
  const painel=page.getByRole('region',{name:'Gerenciar assinatura'})
  await painel.evaluate(el=>el.scrollIntoView({block:'start'}))
  await painel.screenshot({path:`.playwright-mcp/pagamentos/${info.project.name}/01a-pagamento-nova-aba.png`})
  const popupPromise=page.waitForEvent('popup')
  await link.click()
  const popup=await popupPromise
  await expect(popup).toHaveURL(`${invoice}?autoRedirect=true`)
  await expect(page).toHaveURL(/\/dashboard\/veterinario\/alterar-plano$/)
  expect(estado.cria).toBe(1)
  expect(estado.prepara).toBe(1)
  await popup.close()
  estado.pago=true
  await page.bringToFront()
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await expect(page.getByText('Ativa',{exact:true})).toBeVisible()
  await expect(link).toHaveCount(0)
})

test('retorno aguarda o backend mesmo com parâmetro dizendo pago', async ({page,context}, info) => {
  await preparar(context,{pendente:true})
  await page.goto('/pagamento/retorno?status=paid&success=true')
  await expect(page.getByRole('heading',{name:'Estamos acompanhando seu pagamento'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Atualizar situação'})).toBeEnabled()
  await expect(page.getByRole('heading',{name:'Seu plano está ativo!'})).toHaveCount(0)
  await page.screenshot({path:`.playwright-mcp/pagamentos/${info.project.name}/02-aguardando-confirmacao.png`,fullPage:false})
  await expect(page).toHaveURL(/\/pagamento\/retorno/)
})

test('confirmação persistida mostra plano ativo e retorna automaticamente', async ({page,context}, info) => {
  const estado = await preparar(context,{pendente:true})
  await page.goto('/pagamento/retorno')
  await expect(page.getByRole('heading',{name:'Estamos acompanhando seu pagamento'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Atualizar situação'})).toBeEnabled()
  estado.pago=true
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('heading',{name:'Seu plano está ativo!'})).toBeVisible()
  await page.screenshot({path:`.playwright-mcp/pagamentos/${info.project.name}/03-plano-ativo.png`,fullPage:false})
  await expect(page).toHaveURL(/\/dashboard\/veterinario$/)
  expect(estado.cria).toBe(0)
})

test('falha no provedor permite retomar a mesma cobrança', async ({page,context}, info) => {
  const estado=await preparar(context,{pendente:true,falha:true})
  await page.goto('/pagamento/abrir')
  await expect(page.getByRole('heading',{name:'Não foi possível abrir o pagamento'})).toBeVisible()
  await page.screenshot({path:`.playwright-mcp/pagamentos/${info.project.name}/04-falha-recuperavel.png`,fullPage:false})
  estado.falha=false
  await page.getByRole('button',{name:'Tentar novamente'}).click()
  await expect(page).toHaveURL(`${invoice}?autoRedirect=true`)
  expect(estado.prepara).toBe(2)
  expect(estado.cria).toBe(0)
})

test('falha na consulta não é apresentada como pagamento recusado', async ({page,context}) => {
  const estado=await preparar(context,{pendente:true,erroStatus:true})
  await page.goto('/pagamento/retorno')
  const alerta=page.getByRole('region',{name:'Retorno do pagamento'}).getByRole('alert')
  await expect(alerta).toContainText('Isso não significa que o pagamento falhou')
  estado.erroStatus=false
  await page.getByRole('button',{name:'Atualizar situação'}).click()
  await expect(alerta).toHaveCount(0)
})

for (const papel of ['veterinario','clinica','prestador']) {
  test(`pagamento não pula o cadastro incompleto de ${papel}`, async ({page,context}) => {
    await preparar(context,{pago:true,papel,incompleto:true})
    await page.goto('/pagamento/retorno')
    await expect(page).toHaveURL(papel==='veterinario' ? /\/onboarding$/ : new RegExp(`/onboarding/${papel}$`))
  })
}

test('consulta automática é limitada, sem requisições paralelas ou recriação de assinatura', async ({page,context}) => {
  const estado=await preparar(context,{pendente:true})
  await page.clock.install()
  await page.goto('/pagamento/retorno')
  await expect(page.getByRole('button',{name:'Atualizar situação'})).toBeEnabled()
  for(let i=0;i<8;i++) {
    const resposta = page.waitForResponse(r=>r.url().includes('/api/assinaturas/status'))
    await page.clock.fastForward(10_000)
    await resposta
    await expect(page.getByRole('button',{name:'Atualizar situação'})).toBeEnabled()
  }
  const chamadas=estado.consultas
  await page.clock.fastForward(600_000)
  expect(estado.consultas).toBe(chamadas)
  expect(estado.cria).toBe(0)
})
