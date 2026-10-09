/**
 * Texto e ícone dos planos, casados pelo `code` de `subscription_plans`.
 * Quais planos aparecem e o preço vêm do banco (planos ativos).
 */
export type PlanoMetadata = {
  code: string
  name: string
  description: string
  iconPath: string
  defaultPrice: string
  buttonText: string
  benefits: string[]
}

/** Teste grátis da primeira assinatura paga (dias); a 1a fatura vence no fim do teste. */
export const DIAS_TESTE_GRATIS = 14

export const PLANOS_VETERINARIO: PlanoMetadata[] = [
  {
    code: 'vet_starter',
    name: 'Vet Starter',
    description: 'Plano inicial',
    iconPath: '/iconPlans/Plan2.svg',
    defaultPrice: 'R$ 39,90',
    buttonText: 'Assinar plano',
    benefits: [
      'Agendamentos ilimitados',
      'Bloqueio de horário personalizado',
      'Dashboard de métricas nível básico',
      'Busca prioritária no explorar',
      `Teste grátis por ${DIAS_TESTE_GRATIS} dias`,
    ],
  },
  {
    code: 'vet_pro',
    name: 'Vet Pro',
    description: 'Com Módulo Financeiro',
    iconPath: '/iconPlans/Plan3.svg',
    defaultPrice: 'R$ 59,90',
    buttonText: 'Assinar plano',
    benefits: [
      'Todos os benefícios do Vet Starter',
      'Módulo Financeiro',
      'Topo da categoria de busca',
      'Dashboard de métricas nível completo',
      `Teste grátis por ${DIAS_TESTE_GRATIS} dias`,
    ],
  },
]

export const PLANOS_CLINICA: PlanoMetadata[] = [
  {
    code: 'starter',
    name: 'Pequena',
    description: 'Até 5 veterinários',
    iconPath: '/iconPlans/Plan1.svg',
    defaultPrice: 'R$ 99,90',
    buttonText: 'Assinar plano',
    benefits: [
      'Até 5 veterinários na equipe',
      'Notificações por e-mail e WhatsApp',
      'QR Code / Link da clínica',
      `Teste grátis por ${DIAS_TESTE_GRATIS} dias`,
    ],
  },
  {
    code: 'clinic',
    name: 'Média',
    description: 'De 6 a 15 veterinários',
    iconPath: '/iconPlans/Plan2.svg',
    defaultPrice: 'R$ 149,90',
    buttonText: 'Assinar plano',
    benefits: [
      'Até 15 veterinários na equipe',
      'Dashboard de métricas nível básico',
      'Busca prioritária no explorar',
      `Teste grátis por ${DIAS_TESTE_GRATIS} dias`,
    ],
  },
  {
    code: 'clinic_pro',
    name: 'Grande',
    description: 'Veterinários ilimitados',
    iconPath: '/iconPlans/Plan3.svg',
    defaultPrice: 'R$ 219,90',
    buttonText: 'Assinar plano',
    benefits: [
      'Veterinários ilimitados na equipe',
      'Topo da categoria de busca',
      'Dashboard de métricas nível completo',
      `Teste grátis por ${DIAS_TESTE_GRATIS} dias`,
    ],
  },
]

export type PlanoAssinatura = {
  code: string
  name: string
  priceCents: number
  trialDays?: number | null
  searchPriority?: number | null
  features?: unknown
}

const apresentacaoPorCodigo = new Map(
  [...PLANOS_VETERINARIO, ...PLANOS_CLINICA].map((plano) => [plano.code, plano])
)

const ICONES = ['/iconPlans/Plan1.svg', '/iconPlans/Plan2.svg', '/iconPlans/Plan3.svg']

const ROTULOS_FEATURE: Record<string, string> = {
  basic_profile: 'Perfil básico',
  qr_code: 'QR Code',
  complete_profile: 'Perfil completo',
  whatsapp_notifications: 'Notificações por WhatsApp',
  basic_dashboard: 'Dashboard de métricas básico',
  featured_search: 'Destaque na busca',
  complete_dashboard: 'Dashboard de métricas completo',
}

export function formatarPrecoPlano(priceCents: number) {
  if (priceCents <= 0) return 'Grátis'
  const reais = priceCents / 100
  const texto = Number.isInteger(reais) ? String(reais) : reais.toFixed(2).replace('.', ',')
  return `R$ ${texto}`
}

function beneficiosDasFeatures(features: unknown) {
  const lista = Array.isArray(features) ? features : []
  return lista.flatMap((item) => {
    if (typeof item !== 'string') return []
    return [ROTULOS_FEATURE[item] ?? item]
  })
}

/** Card de exibição: preço e nome do banco; texto e ícone do config quando o code existe. */
export function cartaoDePlano(plan: PlanoAssinatura): PlanoMetadata & { priceCents: number; trialDays: number } {
  const apresentacao = apresentacaoPorCodigo.get(plan.code)
  const prioridade = plan.searchPriority ?? 1
  return {
    code: plan.code,
    name: plan.name,
    description: apresentacao?.description ?? 'Assinatura Lince Pet',
    iconPath: apresentacao?.iconPath ?? ICONES[Math.min(Math.max(prioridade, 0), ICONES.length - 1)],
    defaultPrice: formatarPrecoPlano(plan.priceCents),
    buttonText: apresentacao?.buttonText ?? 'Assinar plano',
    benefits: apresentacao?.benefits?.length ? apresentacao.benefits : beneficiosDasFeatures(plan.features),
    priceCents: plan.priceCents,
    trialDays: plan.trialDays ?? 0,
  }
}
