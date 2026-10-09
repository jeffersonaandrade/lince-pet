import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import vine from '@vinejs/vine'
import { ApiRequest, HttpError, handleError } from '@/server/http'

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
