import { abrirMenuDaConta, cnpjAleatorio, CONTAS, emailNoMenu, emailUnico, expect, SENHA, test } from '../fixtures'

test.describe('cadastro', () => {
  test('tutor cria conta e já entra logado', async ({ page }) => {
    const email = emailUnico('tutor')
    await page.goto('/signup/tutor')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Senha', { exact: true }).fill(SENHA)
    await page.getByLabel('Nome', { exact: true }).fill('Ana')
    await page.getByLabel('Sobrenome').fill('Teste')
    await page.getByLabel('Data de Nascimento').click()
    await page.locator('select').selectOption('1990')
    await page.getByText('15', { exact: true }).click()
    await page.getByRole('button', { name: 'Selecione' }).click()
    await page.getByRole('option', { name: 'Feminino' }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()

    await expect(page).toHaveURL('/')
    await abrirMenuDaConta(page)
    await expect(emailNoMenu(page, email)).toBeVisible()
  })

  test('tutor menor de 18 anos não consegue escolher a data de nascimento', async ({ page }) => {
    const limite = new Date()
    limite.setFullYear(limite.getFullYear() - 18)
    await page.goto('/signup/tutor')
    const data = page.getByLabel('Data de Nascimento')
    await data.click()
    const ano = page.locator('select')
    await expect(ano, 'abre no ano em que a pessoa faz 18 anos').toHaveValue(String(limite.getFullYear()))
    await expect(ano.locator('option').first(), 'nenhum ano mais recente na lista').toHaveText(String(limite.getFullYear()))

    const depoisDoLimite = page.locator('[class*="disabled"]').filter({ hasText: /^\d+$/ })
    if ((await depoisDoLimite.count()) > 0) {
      await depoisDoLimite.last().click()
      await expect(data, 'dia depois do limite não é aceito').toHaveValue('')
    }

    await page
      .locator('[class*="day"]:not([class*="otherMonth"]):not([class*="disabled"])')
      .filter({ hasText: new RegExp(`^${limite.getDate()}$`) })
      .click()
    await expect(data).not.toHaveValue('')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByText('Você deve ter pelo menos 18 anos para se cadastrar.')).toHaveCount(0)
  })

  test('e-mail já cadastrado é recusado', async ({ page }) => {
    await page.goto('/signup/veterinario')
    await page.getByLabel('Nome', { exact: true }).fill('Vet')
    await page.getByLabel('Sobrenome').fill('Duplicado')
    await page.getByLabel(/Número de Celular/).fill('11988887777')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByLabel('Email').fill(CONTAS.veterinario.email)
    await page.getByLabel('Senha', { exact: true }).fill(SENHA)
    await page.getByRole('button', { name: 'Finalizar' }).click()
    await expect(page.getByText(/já está em uso|já cadastrado/i)).toBeVisible()
    await expect(page).toHaveURL(/\/signup\/veterinario/)
  })

  test('veterinário cria conta e vai para o onboarding', async ({ page }) => {
    await page.goto('/signup/veterinario')
    await page.getByLabel('Nome', { exact: true }).fill('Vet')
    await page.getByLabel('Sobrenome').fill('Teste')
    await page.getByLabel(/Número de Celular/).fill('11988887777')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByLabel('Email').fill(emailUnico('vet'))
    await page.getByLabel('Senha', { exact: true }).fill(SENHA)
    await page.getByRole('button', { name: 'Finalizar' }).click()
    await expect(page).toHaveURL(/\/onboarding$/)
  })

  test('clínica cria conta com CEP preenchido automaticamente', async ({ page }) => {
    await page.route('**/api/external/cep/**', (route) =>
      route.fulfill({ json: { cep: '13330000', rua: 'Rua das Flores', bairro: 'Centro', cidade: 'Indaiatuba', estado: 'SP' } })
    )
    await page.goto('/signup/clinica')
    await page.getByLabel('Nome da Clinica').fill('Clínica E2E')
    await page.getByLabel('Razão Social').fill('Clínica E2E LTDA')
    await page.getByLabel('CNPJ').fill(cnpjAleatorio())
    await page.getByLabel('Telefone').fill('1938751234')
    await page.getByRole('button', { name: 'Continuar' }).click()

    await page.getByLabel('CEP').fill('13330000')
    await expect(page.getByLabel('Cidade')).toHaveValue('Indaiatuba')
    await expect(page.getByLabel('Rua')).toHaveValue('Rua das Flores')
    await page.getByLabel('Número').fill('100')
    await page.getByRole('button', { name: 'Continuar' }).click()

    await page.getByLabel('Email').fill(emailUnico('clinica'))
    await page.getByLabel('Senha', { exact: true }).fill(SENHA)
    await page.getByRole('button', { name: 'Finalizar' }).click()
    await expect(page).toHaveURL(/\/onboarding\/clinica$/)
  })

  test('prestador escolhe o serviço, cria conta e vai para o onboarding', async ({ page }) => {
    await page.goto('/signup/prestador')
    const tipos = page.getByRole('group', { name: 'Qual serviço você oferece?' }).getByRole('button')
    await expect(tipos.first()).toBeVisible()

    await page.getByLabel('Nome', { exact: true }).fill('Prestador')
    await page.getByLabel('Sobrenome').fill('Teste')
    await page.getByLabel('E-mail').fill(emailUnico('prestador'))
    await page.locator('input[type="password"]').fill(SENHA)
    await page.getByLabel('Celular (WhatsApp)').fill('11912345678')
    await page.getByRole('button', { name: 'Criar conta e montar perfil' }).click()
    await expect(page.getByText('Escolha o tipo de serviço que você oferece.')).toBeVisible()

    await tipos.first().click()
    await expect(tipos.first()).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Criar conta e montar perfil' }).click()
    await expect(page).toHaveURL(/\/onboarding\/prestador$/)
  })
})
