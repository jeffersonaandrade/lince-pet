import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

// Variáveis já injetadas pelo provedor vencem o arquivo.
// O Prisma não sobrescreve o que já está no ambiente, então o .env local (porta 5433) não entra aqui.
if (existsSync('.env.production')) {
  process.loadEnvFile('.env.production')
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
})

process.exit(result.status ?? 1)
