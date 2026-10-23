import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test'

export const SENHA = 'senha123'

export const CONTAS = {
  tutor: { email: 'joao.silva.mockup@email.com', dashboard: '/dashboard/tutor' },
  tutor2: { email: 'maria.santos.mockup@email.com', dashboard: '/dashboard/tutor' },
  veterinario: { email: 'dra.fernanda.mockup@vetclinic.com', dashboard: '/dashboard/veterinario' },
  veterinario2: { email: 'dr.ricardo.mockup@petcare.com', dashboard: '/dashboard/veterinario' },
  clinica: { email: 'contato@petcenter.mockup.com', dashboard: '/dashboard/clinica' },
  prestador: { email: 'tosa.bianca.mockup@email.com', dashboard: '/dashboard/prestador' },
} as const

export type Perfil = keyof typeof CONTAS

export const sessao = (perfil: Perfil) => `e2e/.auth/${perfil}.json`

/** Contextos novos herdam o `storageState` do `test.use`; este força um visitante sem login. */
export const SEM_SESSAO = { cookies: [], origins: [] }

/** E-mail que não existe no seed, para cadastros. */
export const emailUnico = (prefixo = 'e2e') =>
  `${prefixo}.${Date.now()}${Math.floor(Math.random() * 1000)}.mockup@email.com`

/** IP próprio por teste: o limite de tentativas é por IP (x-forwarded-for), então um teste não bloqueia o outro. */
export const ipUnico = () =>
  `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`

export const test = base.extend({
  extraHTTPHeaders: async ({}, use) => {
    await use({ 'x-forwarded-for': ipUnico() })
  },
})

export { expect }

const digitos = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')

export const cnpjAleatorio = () => digitos(14)

/** Tutor novo criado pela API (para testes que mexem na senha ou na sessão sem afetar as contas do seed). */
export async function criarTutor(request: APIRequestContext, email = emailUnico('tutor')) {
  const res = await request.post('/api/tutor/register', {
    data: { email, password: SENHA, nome: 'Teste', sobrenome: 'E2E', dataNascimento: '1990-05-15', sexo: 'outro' },
  })
  expect(res.status(), await res.text()).toBe(201)
  return email
}

/** Tutor novo criado pela tela de cadastro; termina logado na home. */
export async function cadastrarTutorPelaTela(page: Page, email = emailUnico('tutor')) {
  await page.goto('/signup/tutor')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(SENHA)
  await page.getByLabel('Nome', { exact: true }).fill('Teste')
  await page.getByLabel('Sobrenome').fill('E2E')
  await page.getByLabel('Data de Nascimento').click()
  await page.locator('select').selectOption('1990')
  await page.getByText('15', { exact: true }).click()
  await page.getByRole('button', { name: 'Selecione' }).click()
  await page.getByRole('option', { name: 'Feminino' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page).toHaveURL('/')
  return email
}

export async function sair(page: Page) {
  await abrirMenuDaConta(page)
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
}

export async function abrirMenuDaConta(page: Page) {
  await page.getByRole('button', { name: 'Menu da conta' }).click()
}

/** O menu lateral do celular (fechado) repete o e-mail; o primeiro é o do menu da conta. */
export const emailNoMenu = (page: Page, email: string) => page.getByRole('banner').getByText(email).first()

export async function entrar(page: Page, email: string, senha = SENHA) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
}
