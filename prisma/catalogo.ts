/**
 * Catálogo que um banco vazio precisa para a página de planos, o cadastro de
 * especialidades e os planos de saúde do perfil.
 *
 * Os planos de assinatura são as linhas atuais de `subscription_plans` (seeder
 * do Adonis + ajustes das migrations). Preço de exibição em `src/config/planos.ts`
 * é outra fonte e não entra aqui.
 */

export type PlanoAssinaturaSeed = {
  code: string
  name: string
  targetType: 'veterinario' | 'clinica'
  priceCents: number
  currency: string
  cycle: string | null
  monthlyAppointmentLimit: number | null
  features: string[]
  searchPriority: number
  trialDays: number
  active: number
}

export const PLANOS_ASSINATURA: PlanoAssinaturaSeed[] = [
  {
    code: 'free',
    name: 'Gratuito',
    targetType: 'veterinario',
    priceCents: 0,
    currency: 'brl',
    cycle: null,
    monthlyAppointmentLimit: 10,
    features: ['basic_profile', 'qr_code'],
    searchPriority: 0,
    trialDays: 0,
    active: 1,
  },
  {
    code: 'pro',
    name: 'Pro',
    targetType: 'veterinario',
    priceCents: 5900,
    currency: 'brl',
    cycle: 'MONTHLY',
    monthlyAppointmentLimit: null,
    features: ['complete_profile', 'whatsapp_notifications', 'basic_dashboard'],
    searchPriority: 1,
    trialDays: 14,
    active: 1,
  },
  {
    code: 'pro_plus',
    name: 'Pro+',
    targetType: 'veterinario',
    priceCents: 9900,
    currency: 'brl',
    cycle: 'MONTHLY',
    monthlyAppointmentLimit: null,
    features: ['complete_profile', 'featured_search', 'whatsapp_notifications', 'complete_dashboard'],
    searchPriority: 2,
    trialDays: 14,
    active: 1,
  },
  {
    code: 'starter',
    name: 'Starter',
    targetType: 'clinica',
    priceCents: 7500,
    currency: 'brl',
    cycle: 'MONTHLY',
    monthlyAppointmentLimit: null,
    features: ['basic_profile', 'qr_code'],
    searchPriority: 0,
    trialDays: 14,
    active: 1,
  },
  {
    code: 'clinic',
    name: 'Clinic',
    targetType: 'clinica',
    priceCents: 13500,
    currency: 'brl',
    cycle: 'MONTHLY',
    monthlyAppointmentLimit: null,
    features: ['complete_profile', 'whatsapp_notifications', 'basic_dashboard'],
    searchPriority: 1,
    trialDays: 14,
    active: 1,
  },
  {
    code: 'clinic_pro',
    name: 'Clinic Pro',
    targetType: 'clinica',
    priceCents: 20900,
    currency: 'brl',
    cycle: 'MONTHLY',
    monthlyAppointmentLimit: null,
    features: ['complete_profile', 'featured_search', 'whatsapp_notifications', 'complete_dashboard'],
    searchPriority: 2,
    trialDays: 14,
    active: 1,
  },
]

/**
 * Tipos de profissional pet além de vet e clínica. Tipo novo = item novo aqui (upsert por slug), sem migration.
 * `modalidade`: duracao (hora de início + duração do serviço) | periodo (início e fim, ex.: hospedagem).
 */
export const TIPOS_SERVICO: {
  slug: string
  nome: string
  descricao: string
  modalidade: 'duracao' | 'periodo'
  ordem: number
}[] = [
  { slug: 'tosador', nome: 'Banho e tosa', descricao: 'Banho, tosa e higiene', modalidade: 'duracao', ordem: 1 },
  { slug: 'passeador', nome: 'Passeador', descricao: 'Passeios com o pet', modalidade: 'duracao', ordem: 2 },
  { slug: 'adestrador', nome: 'Adestrador', descricao: 'Aulas de adestramento e comportamento', modalidade: 'duracao', ordem: 3 },
  { slug: 'pet_sitter', nome: 'Pet sitter', descricao: 'Hospedagem e cuidado do pet por período', modalidade: 'periodo', ordem: 4 },
]

/** Nomes criados pelo mockup_seeder (firstOrCreate por nome). */
export const PLANOS_SAUDE = [
  'Care pet',
  'Eupet',
  'Jofi',
  'Pet Love',
  'Pet Plan',
  'Pet top',
  'Petlove Saúde',
  'Porto Seguro Pet',
  'SulAmérica Pet',
] as const

export const DIFERENCIAIS: { nome: string; descricao: string }[] = [
  { nome: 'Estacionamento', descricao: 'Vaga para clientes na porta ou no prédio' },
  { nome: 'Atendimento 24h', descricao: 'Plantão de emergência durante a madrugada' },
  { nome: 'Internação', descricao: 'Leitos para observação e pós-operatório' },
  { nome: 'Exames de imagem', descricao: 'Raio-x e ultrassom no local' },
  { nome: 'Farmácia', descricao: 'Medicamentos à disposição na saída da consulta' },
  { nome: 'Banho e tosa', descricao: 'Higiene e tosa no mesmo endereço' },
  { nome: 'Acessibilidade', descricao: 'Acesso sem degrau e banheiro adaptado' },
  { nome: 'Wi-Fi', descricao: 'Rede para tutores na recepção' },
  { nome: 'Atendimento felino', descricao: 'Sala e manejo separados para gatos' },
]
