import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import vine from '@vinejs/vine'
import { ApiRequest, CORPO_MAXIMO, HttpError, handleError, ok, texto } from '@/server/http'

describe('json (corpo das respostas)', () => {
  it('nunca envia senha nem tokens do Google, mesmo em relações aninhadas', async () => {
    const usuario = {
      id: 'u1',
      nome: 'Ana',
      password: '$hash',
      googleAccessToken: 'tok',
      googleRefreshToken: 'ref',
      googleTokenExpiresAt: new Date('2026-01-01T00:00:00Z'),
      googleCalendarAuthorized: 1,
    }
    const res = ok([{ id: 'f1', veterinario: { id: 'v1', user: usuario }, clinica: { user: usuario } }])
    const corpo = await res.json()

    expect(corpo[0].veterinario.user).toEqual({ id: 'u1', nome: 'Ana', googleCalendarAuthorized: 1 })
    expect(corpo[0].clinica.user).toEqual({ id: 'u1', nome: 'Ana', googleCalendarAuthorized: 1 })
  })
})

describe('ApiRequest (equivalente ao bodyparser do Adonis)', () => {
  it('mescla query string e JSON e converte string vazia em null', async () => {
    const req = new NextRequest('http://x/api/a?page=2&q=abc', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: 'Ana', bio: '' }),
    })
    const r = await ApiRequest.from(req)
    expect(r.all()).toEqual({ page: '2', q: 'abc', nome: 'Ana', bio: null })
    expect(r.only(['nome', 'page'])).toEqual({ nome: 'Ana', page: '2' })
  })

  it('recusa corpo acima do limite com 413, pelo content-length ou pelo tamanho lido', async () => {
    const declarado = new NextRequest('http://x/api/a', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(CORPO_MAXIMO + 1) },
      body: '{}',
    })
    await expect(ApiRequest.from(declarado)).rejects.toMatchObject({ status: 413 })

    const grande = new NextRequest('http://x/api/a', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ x: 'a'.repeat(CORPO_MAXIMO) }),
    })
    await expect(ApiRequest.from(grande)).rejects.toMatchObject({ status: 413 })
  })

  it('lê multipart com campos aninhados e arquivo', async () => {
    const form = new FormData()
    form.append('nome', 'Rex')
    form.append('itens[0][id]', '1')
    form.append('itens[1][id]', '2')
    form.append('foto', new File([new Uint8Array(10)], 'pet.png', { type: 'image/png' }))
    const req = new NextRequest('http://x/api/pets', { method: 'POST', body: form })
    const r = await ApiRequest.from(req)
    expect(r.input('nome')).toBe('Rex')
    expect(r.input('itens')).toEqual([{ id: '1' }, { id: '2' }])
    const file = r.file('foto', { size: '1mb', extnames: ['png'] })!
    expect(file.isValid).toBe(true)
    expect(file.extname).toBe('png')
    expect(r.file('foto', { extnames: ['jpg'] })!.isValid).toBe(false)
  })

  it('text() só devolve texto: objetos da query/JSON não viram filtro do Prisma', async () => {
    const req = new NextRequest('http://x/api/busca?nome[not]=x&cidade=Recife&page=2', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ motivo: { contains: 'a' }, idade: 3, lista: ['a'], vazio: '', nan: null }),
    })
    const r = await ApiRequest.from(req)
    expect(r.text('nome')).toBeUndefined()
    expect(r.text('motivo')).toBeUndefined()
    expect(r.text('lista')).toBeUndefined()
    expect(r.text('vazio')).toBeUndefined()
    expect(r.text('ausente')).toBeUndefined()
    expect(r.text('cidade')).toBe('Recife')
    expect(r.text('idade')).toBe('3')
  })

  it('chaves __proto__/constructor/prototype não poluem Object.prototype', async () => {
    const form = new FormData()
    form.append('__proto__[viaForm]', 'x')
    const req = new NextRequest(
      'http://x/api/a?__proto__[token]=jwt&constructor[prototype][bcc]=a@x.com&a[__proto__][b]=1&ok=1',
      { method: 'POST', body: form }
    )
    const r = await ApiRequest.from(req)
    expect(r.all()).toEqual({ ok: '1' })
    const vazio = {} as Record<string, unknown>
    expect(vazio.token).toBeUndefined()
    expect(vazio.bcc).toBeUndefined()
    expect(vazio.viaForm).toBeUndefined()
    expect(r.input('token')).toBeUndefined()
    expect(r.input('toString')).toBeUndefined()
    expect(r.text('hasOwnProperty')).toBeUndefined()
    expect(r.only(['token', 'ok' as const])).toEqual({ ok: '1' })
  })
})

describe('texto', () => {
  it('aceita string (inclusive vazia) e número finito', () => {
    expect(texto('abc')).toBe('abc')
    expect(texto('')).toBe('')
    expect(texto(0)).toBe('0')
    expect(texto(1.5)).toBe('1.5')
  })

  it('recusa o resto', () => {
    for (const v of [NaN, Infinity, null, undefined, true, {}, ['a'], () => 'a']) expect(texto(v)).toBeUndefined()
  })
})

describe('handleError (equivalente ao HttpExceptionHandler)', () => {
  it('validação VineJS vira 422 com a primeira mensagem', async () => {
    const validator = vine.compile(vine.object({ email: vine.string().email() }))
    const error = await validator.validate({ email: 'x' }).catch((e) => e)
    const res = handleError(error)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.status).toBe(422)
    expect(typeof body.message).toBe('string')
  })

  it('HttpError preserva status e corpo', async () => {
    const res = handleError(new HttpError(403, { message: 'Acesso negado' }))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ message: 'Acesso negado' })
  })

  it('erro desconhecido vira 500 genérico', async () => {
    const res = handleError(new Error('boom'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ message: 'Aconteceu um erro inesperado' })
  })
})
