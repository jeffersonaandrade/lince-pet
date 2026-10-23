import { randomBytes } from 'node:crypto'
import { defineConfig, devices } from '@playwright/test'
import webpush from 'web-push'

const vapid = webpush.generateVAPIDKeys()

const PORT = 3000

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Sem isso um seletor errado espera o teste inteiro (minutos) e parece travado.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    launchOptions: { slowMo: Number(process.env.E2E_SLOWMO ?? 0) },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${PORT}/login`,
    // Um `npm run dev` comum mandaria e-mail de verdade; só reaproveite um servidor iniciado com este mesmo env.
    reuseExistingServer: process.env.E2E_REUSE_SERVER === '1',
    timeout: 180_000,
    // Nada sai de verdade: e-mail e WhatsApp só no log, sem gateway e sem o segredo do cron de produção.
    env: {
      TZ: 'UTC',
      MAIL_DRIVER: 'log',
      WHATSAPP_PROVIDER: 'log',
      WHATSAPP_GATEWAY_URL: '',
      WHATSAPP_GATEWAY_TOKEN: '',
      CRON_SECRET: randomBytes(24).toString('hex'),
      VAPID_PUBLIC_KEY: vapid.publicKey,
      VAPID_PRIVATE_KEY: vapid.privateKey,
      VAPID_SUBJECT: 'mailto:e2e@lincepet.local',
    },
  },
})
