import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { linkWhatsAppManual, mensagemWhatsAppManual } from '@/lib/whatsapp-manual'
import WhatsAppManual from '@/components/TutorContact/WhatsAppManual'

describe('Aviso manual ao telefone cadastrado do tutor', () => {
  it.each(['(81) 99999-1234', '81999991234', '+55 (81) 99999-1234'])( 'normaliza %s sem duplicar o DDI', telefone => {
    const url = new URL(linkWhatsAppManual(telefone, { nome: 'João & Maria', data: '28/10/2026', horario: '14:30', status: 'confirmado' })!)
    expect(url.origin + url.pathname).toBe('https://wa.me/5581999991234')
    expect(url.searchParams.get('text')).toContain('Olá, João & Maria!')
    expect(url.searchParams.get('text')).toContain('28/10/2026 às 14:30')
  })

  it.each([null, undefined, '', '12345', '8199999123456789'])( 'não cria link com telefone ausente ou incompleto (%s)', telefone => {
    expect(linkWhatsAppManual(telefone, {})).toBeNull()
  })

  it.each([['cancelado', 'Cancelado'], ['pendente', 'Aguardando confirmação'], ['confirmado', 'Confirmado']])('informa a situação real %s', (status, rotulo) => {
    expect(mensagemWhatsAppManual({ status })).toContain(`Situação: ${rotulo}.`)
  })

  it('informa resultado disponível sem incluir laudo nem dados clínicos', () => {
    const mensagem = mensagemWhatsAppManual({ laudoDisponivel: true })
    expect(mensagem).toContain('O resultado está disponível para consulta no site.')
    expect(mensagem.match(/https:\/\/\S+/g)).toEqual(['https://lincepet.com.br/dashboard/tutor'])
  })

  it('impede que campos do cadastro injetem links e linhas na mensagem', () => {
    const mensagem = mensagemWhatsAppManual({ nome: 'João\nhttps://golpe.test', local: 'www.golpe.test' })
    expect(mensagem).not.toContain('golpe.test')
    expect(mensagem).toContain('Olá, João [link removido]!')
  })

  it('respeita a opção de não receber avisos por WhatsApp', () => {
    const html = renderToStaticMarkup(createElement(WhatsAppManual, { telefone: '81999991234', permitido: false, aviso: {} }))
    expect(html).not.toContain('wa.me')
    expect(html).toContain('O tutor desativou')
  })

  it('não oferece envio sem telefone e explica a indisponibilidade', () => {
    const html = renderToStaticMarkup(createElement(WhatsAppManual, { aviso: {} }))
    expect(html).not.toContain('<a ')
    expect(html).toContain('sem telefone válido')
  })

  it('avisa qual conta envia e não confunde abertura com envio', () => {
    const html = renderToStaticMarkup(createElement(WhatsAppManual, { telefone: '81999991234', aviso: {} }))
    expect(html).toContain('conta conectada')
    expect(html).toContain('não confirma o envio')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('target="_blank"')
  })
})
