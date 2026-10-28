import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'
export default defineConfig({
  ...base,
  globalSetup: undefined,
  testMatch: /whatsapp-manual.spec.ts/,
  // Toda API é interceptada pelo teste; dispensa seed e acesso ao banco.
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] } },
  ],
})
