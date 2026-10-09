import 'server-only'

export function env(name: string): string | undefined {
  const value = process.env[name]
  return value === undefined || value === '' ? undefined : value
}

export function requiredEnv(name: string): string {
  const value = env(name)
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`)
  return value
}

export const isProduction = process.env.NODE_ENV === 'production'
