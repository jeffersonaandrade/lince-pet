export type Role = 'tutor' | 'veterinario' | 'clinica'

export type ContractCase = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  as?: Role
  body?: unknown
  /** Compara valores, não só o formato (bom para catálogos estáticos). */
  exact?: boolean
  /** Altera dados: só roda com CONTRACT_ALLOW_WRITES=1 em banco de staging. */
  write?: boolean
}

/**
 * Casos de contrato por módulo. Paths seguem o Adonis (sem o prefixo /api).
 * Parâmetros `:nome` são lidos de CONTRACT_<NOME> (ex. :vetId -> CONTRACT_VET_ID).
 */
export const contractCases: ContractCase[] = [
  // Catálogos e externos
  { method: 'GET', path: '/especialidades', exact: true },
  { method: 'GET', path: '/planos', exact: true },
  { method: 'GET', path: '/assinaturas/planos', exact: true },
  { method: 'GET', path: '/external/cep/01001000', exact: true },

  // Autenticação
  { method: 'GET', path: '/auth/me', as: 'tutor' },
  { method: 'GET', path: '/auth/me', as: 'veterinario' },
  { method: 'GET', path: '/auth/me', as: 'clinica' },
  { method: 'GET', path: '/auth/me' },
  { method: 'POST', path: '/auth/login', body: { email: 'nao-existe@lincepet.com', password: 'x' } },

  // Favoritos e notificações
  { method: 'GET', path: '/favorites', as: 'tutor' },
  { method: 'GET', path: '/favorites', as: 'veterinario' },
  { method: 'GET', path: '/favorites/check?veterinarioId=:vetId', as: 'tutor' },
  { method: 'GET', path: '/notifications', as: 'tutor' },
  { method: 'GET', path: '/notifications/unread-count', as: 'veterinario' },

  // Tutor e pets
  { method: 'GET', path: '/pets', as: 'tutor' },
  { method: 'GET', path: '/pets', as: 'clinica' },

  // Avaliações (públicas)
  { method: 'GET', path: '/veterinarios/:vetId/avaliacoes' },
  { method: 'GET', path: '/veterinarios/:vetId/nota-media' },
  { method: 'GET', path: '/clinicas/:clinicaId/avaliacoes' },
  { method: 'GET', path: '/clinicas/:clinicaId/nota-media' },
  { method: 'GET', path: '/veterinarios/avaliacoes-recentes', as: 'veterinario' },
  { method: 'GET', path: '/clinicas/avaliacoes-recentes', as: 'clinica' },

  // Busca pública e perfis
  { method: 'GET', path: '/veterinarios/search' },
  { method: 'GET', path: '/veterinarios/:vetId' },
  { method: 'GET', path: '/clinicas' },
  { method: 'GET', path: '/clinicas/:clinicaId' },

  // Veterinário
  { method: 'GET', path: '/onboarding/progress', as: 'veterinario' },
  { method: 'GET', path: '/veterinarios/schedule', as: 'veterinario' },
  { method: 'GET', path: '/veterinarios/dashboard/estatisticas', as: 'veterinario' },
  { method: 'GET', path: '/veterinarios/agendamentos', as: 'veterinario' },

  // Clínica
  { method: 'GET', path: '/clinicas/onboarding/progress', as: 'clinica' },
  { method: 'GET', path: '/clinicas/dashboard/estatisticas', as: 'clinica' },
  { method: 'GET', path: '/clinicas/professionals', as: 'clinica' },
  { method: 'GET', path: '/clinicas/agendamentos', as: 'clinica' },
  { method: 'GET', path: '/veterinarios', as: 'clinica' },

  // Agendamentos
  { method: 'GET', path: '/agendamentos', as: 'tutor' },
  { method: 'GET', path: '/agendamentos/disponibilidade/:vetId?data=2030-01-07', as: 'tutor' },

  // Assinaturas
  { method: 'GET', path: '/assinaturas/status', as: 'veterinario' },
  { method: 'GET', path: '/assinaturas/status', as: 'tutor' },

  // Webhooks
  { method: 'GET', path: '/webhooks/asaas', exact: true },
  { method: 'POST', path: '/webhooks/asaas', body: { event: 'PING' } },
]
