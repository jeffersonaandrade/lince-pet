/** Fonte única dos planos exibidos em /precos e nas telas de alterar plano. */
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
