import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const sendMailMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/mail', () => ({
  sendMail: sendMailMock,
  escapeHtml: (v: unknown) =>
    String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
}))

import { notifications } from '@/server/services/notifications'

let tmp: string
let semLogo: string

const ultimoEnvio = () => sendMailMock.mock.calls.at(-1)![0] as { to: string; from: string; subject: string; html: string }

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lince-notif-'))
  semLogo = fs.mkdtempSync(path.join(os.tmpdir(), 'lince-sem-logo-'))
  for (const f of ['a.png', 'a.jpg', 'a.jpeg', 'a.gif', 'a.svg', 'a.bmp']) fs.writeFileSync(path.join(tmp, f), 'LOGO')
})

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.rmSync(semLogo, { recursive: true, force: true })
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('EMAIL_FROM', '')
  vi.stubEnv('EMAIL_LOGO_URL', '')
  vi.stubEnv('EMAIL_LOGO_BASE64', '')
  vi.stubEnv('EMAIL_LOGO_MIME', '')
  vi.stubEnv('EMAIL_LOGO_PATH', '')
  vi.spyOn(process, 'cwd').mockReturnValue(semLogo)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  sendMailMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const consulta = { nomeTutor: 'Ana', nomeVeterinario: 'Dr. João', data: '10/10/2026', horario: '14:00', tipo: 'presencial' }

describe('remetente e logo dos e-mails', () => {
  it('sem EMAIL_FROM usa noreply@lincepet.com; com EMAIL_FROM usa o configurado', async () => {
    await notifications.sendAppointmentConfirmation('ana@x.com', consulta)
    expect(ultimoEnvio().from).toBe('Lince Pet <noreply@lincepet.com>')

    vi.stubEnv('EMAIL_FROM', 'avisos@lince.test')
    await notifications.sendAppointmentConfirmation('ana@x.com', consulta)
    expect(ultimoEnvio().from).toBe('Lince Pet <avisos@lince.test>')
  })

  it('sem logo configurado o cabeçalho cai no texto padrão', async () => {
    await notifications.sendAppointmentConfirmation('ana@x.com', consulta)
    expect(ultimoEnvio().html).toContain('🐾 Lince Pet')
    expect(ultimoEnvio().html).not.toContain('alt="Lince Pet"')
  })

  it('EMAIL_LOGO_URL tem prioridade sobre base64 e arquivo', async () => {
    vi.stubEnv('EMAIL_LOGO_URL', 'https://cdn.test/logo.png')
    vi.stubEnv('EMAIL_LOGO_BASE64', 'QUJD')
    vi.stubEnv('EMAIL_LOGO_PATH', path.join(tmp, 'a.png'))
    await notifications.sendAppointmentConfirmation('ana@x.com', consulta)
    expect(ultimoEnvio().html).toContain('<img src="https://cdn.test/logo.png" alt="Lince Pet"')
    expect(ultimoEnvio().html).toContain('height:90px')
  })

  it('EMAIL_LOGO_BASE64 vira data URI com o MIME configurado (ou png por padrão)', async () => {
    vi.stubEnv('EMAIL_LOGO_BASE64', ' base64,QUJD ')
    await notifications.sendAppointmentConfirmation('ana@x.com', consulta)
    expect(ultimoEnvio().html).toContain('src="data:image/png;base64,QUJD"')

    vi.stubEnv('EMAIL_LOGO_MIME', 'image/webp')
    await notifications.sendAppointmentConfirmation('ana@x.com', consulta)
    expect(ultimoEnvio().html).toContain('src="data:image/webp;base64,QUJD"')
  })

  it('base64 que já é data URI é usado como está', async () => {
    vi.stubEnv('EMAIL_LOGO_BASE64', '  data:image/gif;base64,R0lG  ')
    await notifications.sendAppointmentConfirmation('ana@x.com', consulta)
    expect(ultimoEnvio().html).toContain('src="data:image/gif;base64,R0lG"')
  })

  it.each([
    ['a.png', 'image/png'],
    ['a.jpg', 'image/jpeg'],
    ['a.jpeg', 'image/jpeg'],
    ['a.gif', 'image/gif'],
    ['a.svg', 'image/svg+xml'],
    ['a.bmp', 'application/octet-stream'],
  ])('EMAIL_LOGO_PATH %s é embutido com o content-type %s', async (arquivo, mime) => {
    vi.stubEnv('EMAIL_LOGO_PATH', path.join(tmp, arquivo))
    await notifications.sendAppointmentConfirmation('ana@x.com', consulta)
    const b64 = Buffer.from('LOGO').toString('base64')
    expect(ultimoEnvio().html).toContain(`src="data:${mime};base64,${b64}"`)
  })

  it('EMAIL_LOGO_PATH inexistente procura os candidatos em app/services do projeto', async () => {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'lince-cand-'))
    try {
      fs.mkdirSync(path.join(raiz, 'app', 'services'), { recursive: true })
      fs.writeFileSync(path.join(raiz, 'app', 'services', 'IconSilver.jpg'), 'ICON')
      vi.mocked(process.cwd).mockReturnValue(raiz)
      vi.stubEnv('EMAIL_LOGO_PATH', path.join(raiz, 'nao-existe.png'))
      await notifications.sendAppointmentConfirmation('ana@x.com', consulta)
      expect(ultimoEnvio().html).toContain(`src="data:image/jpeg;base64,${Buffer.from('ICON').toString('base64')}"`)
    } finally {
      fs.rmSync(raiz, { recursive: true, force: true })
    }
  })

  it('erro ao ler o arquivo do logo não impede o envio (cai no cabeçalho em texto)', async () => {
    vi.stubEnv('EMAIL_LOGO_PATH', path.join(tmp, 'a.png'))
    vi.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
      throw new Error('EACCES')
    })
    const r = await notifications.sendAppointmentConfirmation('ana@x.com', consulta)
    expect(r).toEqual({ success: true })
    expect(ultimoEnvio().html).toContain('🐾 Lince Pet')
  })
})

describe('sendAppointmentConfirmation', () => {
  it('envia ao tutor com assunto, código informado e observações', async () => {
    const r = await notifications.sendAppointmentConfirmation(
      'ana@x.com',
      { ...consulta, localNome: 'Clínica Centro', observacoes: 'Trazer exames' },
      '123456'
    )
    expect(r).toEqual({ success: true })
    const m = ultimoEnvio()
    expect(m.to).toBe('ana@x.com')
    expect(m.subject).toBe('Confirmação de Agendamento - Lince Pet')
    expect(m.html).toContain('123456')
    expect(m.html).toContain('Clínica Centro')
    expect(m.html).toContain('Trazer exames')
  })

  it('sem código gera um de 6 dígitos', async () => {
    await notifications.sendAppointmentConfirmation('ana@x.com', consulta)
    const codigo = ultimoEnvio().html.match(/class="code-value">\s*(\d+)/)![1]
    expect(codigo).toMatch(/^\d{6}$/)
  })

  it('falha do provedor devolve success:false e loga a resposta do provedor', async () => {
    const erro = Object.assign(new Error('422'), { response: { status: 422 } })
    sendMailMock.mockRejectedValueOnce(erro)
    const r = await notifications.sendAppointmentConfirmation('ana@x.com', consulta)
    expect(r).toEqual({ success: false, error: erro })
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Detalhes da resposta'), expect.stringContaining('422'))
  })

  it('falha sem response não tenta logar detalhes', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('rede'))
    const r = await notifications.sendAppointmentConfirmation('ana@x.com', consulta)
    expect(r.success).toBe(false)
    expect(console.error).toHaveBeenCalledTimes(1)
  })
})

describe('sendAppointmentCancellation', () => {
  const payload = { nomeTutor: 'Ana', nomeVeterinario: 'Dr. João', data: '10/10/2026', horario: '14:00', motivo: 'Imprevisto' }

  it('envia o cancelamento com assunto próprio', async () => {
    const r = await notifications.sendAppointmentCancellation('ana@x.com', payload)
    expect(r).toEqual({ success: true })
    expect(ultimoEnvio()).toMatchObject({ to: 'ana@x.com', subject: 'Cancelamento de Agendamento - Lince Pet' })
    expect(ultimoEnvio().html).toContain('Imprevisto')
  })

  it('falha com response loga a resposta e devolve success:false', async () => {
    const erro = Object.assign(new Error('x'), { response: 'smtp 550' })
    sendMailMock.mockRejectedValueOnce(erro)
    expect(await notifications.sendAppointmentCancellation('ana@x.com', payload)).toEqual({ success: false, error: erro })
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Resend/SMTP'), 'smtp 550')
  })

  it('falha sem response só loga o erro', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('x'))
    expect((await notifications.sendAppointmentCancellation('ana@x.com', payload)).success).toBe(false)
    expect(console.error).toHaveBeenCalledTimes(1)
  })
})

describe('reagendamento', () => {
  it('tutor recebe o novo horário com o código', async () => {
    const r = await notifications.sendAppointmentRescheduled('ana@x.com', { ...consulta, horario: '16:30', verificationCode: '654321' })
    expect(r).toEqual({ success: true })
    expect(ultimoEnvio().subject).toBe('Agendamento Reagendado - Lince Pet')
    expect(ultimoEnvio().html).toContain('16:30')
    expect(ultimoEnvio().html).toContain('654321')
  })

  it('falha ao avisar o tutor não lança', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('x'))
    const r = await notifications.sendAppointmentRescheduled('ana@x.com', { ...consulta, verificationCode: '1' })
    expect(r.success).toBe(false)
  })

  it('veterinário recebe o aviso de reagendamento', async () => {
    const r = await notifications.sendAppointmentRescheduledToVeterinarian('vet@x.com', {
      nomeVeterinario: 'Dr. João',
      nomeTutor: 'Ana',
      data: '11/10/2026',
      horario: '09:00',
      tipo: 'presencial',
    })
    expect(r).toEqual({ success: true })
    expect(ultimoEnvio()).toMatchObject({ to: 'vet@x.com', subject: 'Aviso de Reagendamento - Lince Pet' })
    expect(ultimoEnvio().html).toContain('11/10/2026')
  })

  it('falha ao avisar o veterinário não lança', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('x'))
    const r = await notifications.sendAppointmentRescheduledToVeterinarian('vet@x.com', {
      nomeVeterinario: 'V',
      nomeTutor: 'T',
      data: 'd',
      horario: null,
      tipo: null,
    })
    expect(r.success).toBe(false)
  })
})

describe('sendPixPaymentEmail', () => {
  it('monta QR, código copia-e-cola, validade e link, escapando HTML', async () => {
    vi.stubEnv('EMAIL_LOGO_URL', 'https://cdn.test/l.png')
    const r = await notifications.sendPixPaymentEmail('ana@x.com', {
      nomeTutor: 'Ana <b>',
      descricao: 'Consulta',
      valor: 150.5,
      qrEncodedImage: 'data:image/png;base64,QR',
      pixPayload: '000201PIX',
      expirationDate: '2026-10-10',
      invoiceUrl: 'https://asaas.test/i/1',
    })
    expect(r).toEqual({ success: true })
    const m = ultimoEnvio()
    expect(m.subject).toBe('Pagamento da consulta - PIX')
    expect(m.html).toContain('alt="QR PIX"')
    expect(m.html).toContain('000201PIX')
    expect(m.html).toContain('Validade do QR: 2026-10-10')
    expect(m.html).toContain('href="https://asaas.test/i/1"')
    expect(m.html).toContain('R$')
    expect(m.html).toContain('150,50')
    expect(m.html).toContain('Ana &lt;b&gt;')
    expect(m.html).not.toContain('Ana <b>')
    expect(m.html).toContain('height:45px')
  })

  it('sem QR, código, validade, link e logo omite esses blocos', async () => {
    await notifications.sendPixPaymentEmail('ana@x.com', { nomeTutor: 'Ana', descricao: 'Consulta', valor: 10, currency: 'USD' })
    const html = ultimoEnvio().html
    expect(html).not.toContain('QR PIX')
    expect(html).not.toContain('Validade do QR')
    expect(html).not.toContain('Abrir página de pagamento')
    expect(html).toContain('🐾 Lince Pet')
    expect(html).toContain('US$')
  })

  it('falha no envio devolve success:false', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('x'))
    expect((await notifications.sendPixPaymentEmail('a@x', { nomeTutor: 'A', descricao: 'd', valor: 1 })).success).toBe(false)
  })
})

describe('sendNewAppointmentToVeterinarian', () => {
  it('avisa o vet do novo agendamento com contato do tutor', async () => {
    const r = await notifications.sendNewAppointmentToVeterinarian('vet@x.com', {
      nomeVeterinario: 'Dr. João',
      nomeTutor: 'Ana',
      data: '10/10/2026',
      horario: '14:00',
      tipo: 'presencial',
      contatoTutor: { email: 'ana@x.com', celular: '81999990000' },
    })
    expect(r).toEqual({ success: true })
    expect(ultimoEnvio()).toMatchObject({ to: 'vet@x.com', subject: 'Novo agendamento recebido - Lince Pet' })
    expect(ultimoEnvio().html).toContain('81999990000')
  })

  it('falha no envio devolve success:false', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('x'))
    const r = await notifications.sendNewAppointmentToVeterinarian('vet@x.com', {
      nomeVeterinario: 'V',
      nomeTutor: 'T',
      data: 'd',
      horario: null,
      tipo: null,
    })
    expect(r.success).toBe(false)
  })
})

describe('sendPedidoServico', () => {
  it('assunto recebe o sufixo " - Lince Pet"', async () => {
    const r = await notifications.sendPedidoServico('pre@x.com', 'Novo pedido de Banho e tosa', {
      titulo: 'Novo pedido',
      saudacao: 'Olá, Bia',
      paragrafos: ['Você recebeu um pedido.'],
      detalhes: [['Serviço', 'Banho completo']],
    })
    expect(r).toEqual({ success: true })
    expect(ultimoEnvio()).toMatchObject({ to: 'pre@x.com', subject: 'Novo pedido de Banho e tosa - Lince Pet' })
    expect(ultimoEnvio().html).toContain('Banho completo')
  })

  it('falha no envio devolve success:false', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('x'))
    const r = await notifications.sendPedidoServico('pre@x.com', 'X', { titulo: 't', saudacao: 's', paragrafos: [], detalhes: [] })
    expect(r.success).toBe(false)
  })
})
