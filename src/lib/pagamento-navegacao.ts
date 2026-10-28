/** O destino externo vem do Asaas; nunca aceitar URL livre ou esquema executável. */
export function urlFaturaAsaas(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  try {
    const url = new URL(valor)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !(url.hostname === 'asaas.com' || url.hostname.endsWith('.asaas.com'))) return null
    url.searchParams.set('autoRedirect', 'true')
    return url.toString()
  } catch { return null }
}

export function destinoAposPagamento(user: { userType: string; onboardingComplete?: number }) {
  if (!user.onboardingComplete) {
    if (user.userType === 'veterinario') return '/onboarding'
    if (user.userType === 'clinica') return '/onboarding/clinica'
    if (user.userType === 'prestador') return '/onboarding/prestador'
  }
  return ['veterinario', 'clinica', 'prestador'].includes(user.userType) ? `/dashboard/${user.userType}` : '/'
}
