import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'

const mocks = vi.hoisted(() => {
  const db = {
    $executeRaw: vi.fn(), $queryRaw: vi.fn(), $transaction: vi.fn(),
    recuperacaoCnpj: { findUnique: vi.fn(), updateMany: vi.fn(), count: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    clinica: { findUnique: vi.fn(), count: vi.fn() }, subscription: { count: vi.fn() },
    passwordResetToken: { deleteMany: vi.fn() }, pushInscricao: { deleteMany: vi.fn() },
  }
  return { db, forgot: vi.fn(), hash: vi.fn(), mail: vi.fn() }
})
vi.mock('@/server/db', () => ({ prisma: mocks.db }))
vi.mock('@/server/services/auth', () => ({ forgotPassword: mocks.forgot }))
vi.mock('@/server/auth/password', () => ({ hashPassword: mocks.hash }))
vi.mock('@/server/services/mail', () => ({ sendMail: mocks.mail, defaultFrom: () => 'teste@exemplo.com', escapeHtml: (s: unknown) => String(s) }))
import { confirmarEmailRecuperacao, decidirRecuperacao, listarRecuperacoes, solicitarRecuperacao } from '@/server/services/recuperacao-cnpj'
import { normalizarCnpj } from '@/server/services/cnpj'

const decisao = { decisao: 'aprovar', justificativa: 'Representação conferida em documentação privada.', evidencia: 'Protocolo privado de conferência da representação E2E.', representacaoConferida: true }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.db.$transaction.mockImplementation(async fn => fn(mocks.db))
  mocks.db.$queryRaw.mockResolvedValue([{ id: 'c1', user_id: 'u1' }])
  mocks.db.recuperacaoCnpj.findUnique.mockResolvedValue({ id: 'r1', cnpj: '12345678000199', userId: 'u1', clinicaId: 'c1', emailNovo: 'novo@exemplo.com', emailOriginal: 'anterior@exemplo.com', versaoOriginal: 0 })
  mocks.db.recuperacaoCnpj.updateMany.mockResolvedValue({ count: 1 })
  mocks.db.user.findUnique.mockResolvedValue({ id: 'u1', userType: 'clinica', ativo: 1, isAdmin: 0, email: 'anterior@exemplo.com', tokenVersion: 0 })
  mocks.db.user.findFirst.mockResolvedValue(null)
  mocks.db.recuperacaoCnpj.count.mockResolvedValue(0)
  mocks.db.recuperacaoCnpj.create.mockResolvedValue({ id: 'r1' })
  mocks.db.clinica.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1', cnpj: '12345678000199' })
  mocks.db.clinica.count.mockResolvedValue(1)
  mocks.db.subscription.count.mockResolvedValue(0)
  mocks.db.user.updateMany.mockResolvedValue({ count: 1 })
  mocks.hash.mockResolvedValue('hash-inutilizavel')
})
describe('identidade do CNPJ', () => {
  it('máscara não muda o documento', () => expect(normalizarCnpj('12.345.678/0001-99')).toBe('12345678000199'))
  it.each(['123', '1234567800019x', null])('documento inválido é recusado (%s)', valor => expect(() => normalizarCnpj(valor)).toThrow())
})
it('sem comprovação não inicia recuperação', async () => {
  await expect(decidirRecuperacao('r1', 'admin', { ...decisao, representacaoConferida: false })).rejects.toMatchObject({ status: 400 })
  expect(mocks.db.$transaction).not.toHaveBeenCalled()
})
it('conta administrativa não pode ser transferida pelo fluxo de clínica', async () => {
  mocks.db.user.findUnique.mockResolvedValue({ id: 'u1', userType: 'clinica', ativo: 1, isAdmin: 1 })
  await expect(decidirRecuperacao('r1', 'admin', decisao)).rejects.toMatchObject({ status: 409 })
  expect(mocks.db.user.updateMany).not.toHaveBeenCalled()
})
it('reprovação não modifica credenciais nem envia redefinição', async () => {
  await decidirRecuperacao('r1', 'admin', { decisao: 'reprovar', justificativa: 'A representação apresentada não foi comprovada.' })
  expect(mocks.db.user.updateMany).not.toHaveBeenCalled()
  expect(mocks.forgot).not.toHaveBeenCalled()
})
it('falha de e-mail após recuperação não anuncia rollback inexistente nem exige nova aprovação', async () => {
  mocks.forgot.mockRejectedValueOnce(new Error('provedor indisponível'))
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const resultado = await decidirRecuperacao('r1', 'admin', decisao)
    expect(resultado).toMatchObject({ emailEnviado: false })
    expect(resultado.message).toContain('Esqueci minha senha')
    expect(mocks.db.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ password: 'hash-inutilizavel', redefinicaoSenhaObrigatoria: true, tokenVersion: { increment: 1 } }) }))
    expect(log).toHaveBeenCalledWith('[recuperacao-cnpj] falha no envio de redefinição', { solicitacaoId: 'r1' })
  } finally { log.mockRestore() }
})

const solicitacao = { cnpj: '12.345.678/0001-99', email: ' NOVO@EXEMPLO.COM ', representante: 'Representante fictício', relato: 'Solicito a análise da representação desta empresa.' }
it('solicitação guarda apenas hash do token, não altera acesso e orienta confirmação antes da análise', async () => {
  await solicitarRecuperacao(solicitacao)
  const dados = mocks.db.recuperacaoCnpj.create.mock.calls[0][0].data
  expect(dados).toMatchObject({ emailNovo: 'novo@exemplo.com', cnpj: '12345678000199', emailOriginal: 'anterior@exemplo.com', versaoOriginal: 0 })
  const html = mocks.mail.mock.calls[0][0].html as string
  const token = html.match(/token=([a-f0-9]{64})/)![1]
  expect(dados.tokenHash).toBe(createHash('sha256').update(token).digest('hex'))
  expect(dados.tokenHash).not.toBe(token)
  expect(mocks.db.user.updateMany).not.toHaveBeenCalled()
})
it.each([{ linhas: [] }, { linhas: [{ id: 'a' }, { id: 'b' }] }, { linhas: [{ id: 'c', user_id: null }] }])('CNPJ inexistente/ambíguo/sem conta não abre recuperação nem revela cadastro (%j)', async ({ linhas }) => {
  mocks.db.$queryRaw.mockResolvedValue(linhas)
  expect((await solicitarRecuperacao(solicitacao)).message).toContain('Se os dados permitirem')
  expect(mocks.mail).not.toHaveBeenCalled()
})
it.each([null, { id: 'u1', userType: 'tutor' }, { id: 'u1', userType: 'clinica', isAdmin: 1 }])('conta incompatível não abre solicitação (%j)', async user => {
  mocks.db.user.findUnique.mockResolvedValue(user)
  await solicitarRecuperacao(solicitacao)
  expect(mocks.db.recuperacaoCnpj.create).not.toHaveBeenCalled()
})
it('novo e-mail já usado não abre pedido e preserva a resposta genérica', async () => {
  mocks.db.user.findFirst.mockResolvedValue({ id: 'outra-conta' })
  await solicitarRecuperacao(solicitacao)
  expect(mocks.mail).not.toHaveBeenCalled()
})
it('limite diário do e-mail não bloqueia a clínica nem dispara novos e-mails', async () => {
  mocks.db.recuperacaoCnpj.count.mockResolvedValue(3)
  await solicitarRecuperacao(solicitacao)
  expect(mocks.db.recuperacaoCnpj.create).not.toHaveBeenCalled()
  expect(mocks.mail).not.toHaveBeenCalled()
})
it.each([{ email: 'invalido' }, { relato: 'curto' }, { representante: '' }, { email: 123 }])('entrada inválida é rejeitada antes de consultar conta (%j)', async dados => {
  await expect(solicitarRecuperacao({ ...solicitacao, ...dados })).rejects.toMatchObject({ status: 400 })
  expect(mocks.db.$queryRaw).not.toHaveBeenCalled()
})
it('confirmar e-mail apenas coloca o pedido na fila; apaga hash e não modifica usuário', async () => {
  await confirmarEmailRecuperacao('a'.repeat(64))
  expect(mocks.db.recuperacaoCnpj.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'aguardando_email', tokenExpiraEm: { gt: expect.any(Date) } }), data: expect.objectContaining({ status: 'pendente', tokenHash: null }) }))
  expect(mocks.db.user.updateMany).not.toHaveBeenCalled()
})
it.each([null, '', 'x'.repeat(64)])('token malformado é recusado (%s)', async token => {
  await expect(confirmarEmailRecuperacao(token)).rejects.toMatchObject({ status: 400 })
  expect(mocks.db.recuperacaoCnpj.updateMany).not.toHaveBeenCalled()
})
it('token expirado/usado não confirma novamente', async () => {
  mocks.db.recuperacaoCnpj.updateMany.mockResolvedValue({ count: 0 })
  await expect(confirmarEmailRecuperacao('a'.repeat(64))).rejects.toMatchObject({ status: 400 })
})
it('fila administrativa seleciona dados de auditoria sem hash nem token', async () => {
  mocks.db.recuperacaoCnpj.findMany.mockResolvedValue([])
  await listarRecuperacoes()
  const args = mocks.db.recuperacaoCnpj.findMany.mock.calls[0][0]
  expect(args.take).toBe(100)
  expect(args.select).not.toHaveProperty('tokenHash')
  expect(args.select).not.toHaveProperty('tokenExpiraEm')
})
it('decisão inválida não entra em transação', async () => {
  await expect(decidirRecuperacao('r1', 'admin', { ...decisao, decisao: 'transferir' })).rejects.toMatchObject({ status: 400 })
  expect(mocks.db.$transaction).not.toHaveBeenCalled()
})
it('pedido inexistente não modifica acesso', async () => {
  mocks.db.recuperacaoCnpj.findUnique.mockResolvedValue(null)
  await expect(decidirRecuperacao('r1', 'admin', decisao)).rejects.toMatchObject({ status: 404 })
})
it('pedido não confirmado/já decidido não modifica acesso', async () => {
  mocks.db.recuperacaoCnpj.updateMany.mockResolvedValue({ count: 0 })
  await expect(decidirRecuperacao('r1', 'admin', decisao)).rejects.toMatchObject({ status: 409 })
  expect(mocks.db.user.updateMany).not.toHaveBeenCalled()
})
it('conta com múltiplas clínicas não é transferida por engano', async () => {
  mocks.db.clinica.count.mockResolvedValue(2)
  await expect(decidirRecuperacao('r1', 'admin', decisao)).rejects.toMatchObject({ status: 409 })
  expect(mocks.db.user.updateMany).not.toHaveBeenCalled()
})
it('email ocupado durante a análise recusa sem alterar credenciais', async () => {
  mocks.db.user.findFirst.mockResolvedValue({ id: 'outra-conta' })
  await expect(decidirRecuperacao('r1', 'admin', decisao)).rejects.toMatchObject({ status: 409 })
  expect(mocks.db.user.updateMany).not.toHaveBeenCalled()
})
it('mudança de acesso durante a análise exige nova solicitação e não envia redefinição', async () => {
  mocks.db.user.updateMany.mockResolvedValue({ count: 0 })
  await expect(decidirRecuperacao('r1', 'admin', decisao)).rejects.toMatchObject({ status: 409 })
  expect(mocks.db.passwordResetToken.deleteMany).not.toHaveBeenCalled()
  expect(mocks.forgot).not.toHaveBeenCalled()
})
it('Asaas exige conferência manual e registra a decisão sem chamar o provedor', async () => {
  mocks.db.subscription.count.mockResolvedValue(1)
  await expect(decidirRecuperacao('r1', 'admin', decisao)).rejects.toMatchObject({ status: 409 })
  expect(mocks.db.user.updateMany).not.toHaveBeenCalled()
  await expect(decidirRecuperacao('r1', 'admin', { ...decisao, faturamentoConferido: true })).resolves.toMatchObject({ emailEnviado: true })
  expect(mocks.db.recuperacaoCnpj.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ faturamentoConferido: true }) }))
  expect(mocks.db.pushInscricao.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } })
})
