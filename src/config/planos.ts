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

export const PLANOS_VETERINARIO: PlanoMetadata[] = [
  {
    code: 'pro',
    name: 'Pro',
    description: 'Conheça o LincePet',
    iconPath: '/iconPlans/Plan2.svg',
    defaultPrice: 'R$ 59',
    buttonText: 'Assinar plano',
    benefits: [
      'Todos os benefícios do plano gratuito',
      'Agendamentos ilimitados',
      'Bloqueio de horário personalizado',
      'Dashboard de métricas nível básico',
      'Busca prioritária no explorar',
      'Teste grátis por 7 dias',
    ],
  },
  {
    code: 'pro_plus',
    name: 'Pro+',
    description: 'Conheça o LincePet',
    iconPath: '/iconPlans/Plan3.svg',
    defaultPrice: 'R$ 99',
    buttonText: 'Assinar plano',
    benefits: [
      'Todos os benefícios dos planos anteriores',
      'Topo da categoria de busca',
      'Agendamentos ilimitados',
      'Dashboard de métricas nível completo',
      'Teste grátis por 7 dias',
    ],
  },
]

export const PLANOS_CLINICA: PlanoMetadata[] = [
  {
    code: 'starter',
    name: 'Starter',
    description: 'Conheça o LincePet Clínica',
    iconPath: '/iconPlans/Plan1.svg',
    defaultPrice: 'R$ 75',
    buttonText: 'Assinar plano',
    benefits: ['Posição padrão na busca', 'Cadastro de 1 Veterinário', 'Notificações por e-mail', 'QR Code / Link da clínica'],
  },
  {
    code: 'clinic',
    name: 'Clinic',
    description: 'O essencial para sua clínica',
    iconPath: '/iconPlans/Plan2.svg',
    defaultPrice: 'R$ 149',
    buttonText: 'Assinar plano',
    benefits: [
      'Todos os benefícios do plano gratuito',
      'Até 5 Veterinários na equipe',
      'Dashboard de métricas nível básico',
      'Busca prioritária no explorar',
    ],
  },
  {
    code: 'clinic_pro',
    name: 'Clinic Pro',
    description: 'Controle total e destaque máximo',
    iconPath: '/iconPlans/Plan3.svg',
    defaultPrice: 'R$ 299',
    buttonText: 'Assinar plano',
    benefits: [
      'Todos os benefícios dos planos anteriores',
      'Veterinários ilimitados na equipe',
      'Topo da categoria de busca',
      'Dashboard de métricas nível completo',
      'Suporte prioritário 24/7',
    ],
  },
]
