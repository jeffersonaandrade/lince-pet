import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'
export default defineConfig({
  ...base,
  globalSetup: undefined,
  testMatch: /pagamento-navegacao.spec.ts/,
  projects: [
    { name:'desktop',use:{...devices['Desktop Chrome']} },
    { name:'iphone-webkit',use:{...devices['iPhone 13']} },
  ],
})
