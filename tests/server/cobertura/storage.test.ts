import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import sharp from 'sharp'

vi.mock('node:crypto', () => ({ randomUUID: () => 'uuid-fixo' }))

import { HttpError } from '@/server/http'
import {
  caminhoSeguro,
  chaveDoBucket,
  confirmarUpload,
  deleteObject,
  fotoDoCliente,
  processarImagem,
  toStorageFile,
  uploadClinicaPhoto,
  uploadPetPhoto,
  uploadPhoto,
  uploadPrestadorPhoto,
  uploadTutorPhoto,
  uploadVeterinarioPhoto,
} from '@/server/services/storage'

const BASE = 'https://ref.supabase.co'
const PUBLICO = `${BASE}/storage/v1/object/public/lincepet-media`
const DONO = '11111111-2222-4333-8444-555555555555'
const OUTRO = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const SEGREDO = 'chave-secreta-teste'

let png: Buffer
let jpegGrande: Buffer
let svg: Buffer

beforeAll(async () => {
  png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#ff0000' } }).png().toBuffer()
  jpegGrande = await sharp({ create: { width: 3200, height: 1600, channels: 3, background: '#00ff00' } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Artist: 'gps-secreto' } } })
    .toBuffer()
  svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')
})

const fetchMock = vi.fn()
const resposta = (status: number) =>
  ({ ok: status >= 200 && status < 300, status, headers: new Headers({ 'sb-request-id': 'req-1' }) }) as Response

const arquivo = (buffer: Buffer = png, originalname = 'foto.png') => ({ buffer, originalname, mimetype: 'image/png' })

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(resposta(200))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('SUPABASE_URL', `${BASE}/`)
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SEGREDO)
  vi.stubEnv('SUPABASE_STORAGE_BUCKET', '')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('processarImagem', () => {
  it('converte para WebP, limita a 1600px e remove metadados', async () => {
    const saida = await processarImagem(jpegGrande)
    const meta = await sharp(saida).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(1600)
    expect(meta.height).toBe(800)
    expect(meta.exif).toBeUndefined()
  })

  it('não amplia imagem pequena', async () => {
    const meta = await sharp(await processarImagem(png)).metadata()
    expect([meta.width, meta.height]).toEqual([40, 30])
  })

  it('arquivo vazio responde 400', async () => {
    await expect(processarImagem(Buffer.alloc(0))).rejects.toMatchObject({ status: 400, body: { message: 'Arquivo vazio' } })
  })

  it('arquivo acima de 5 MB responde 400', async () => {
    await expect(processarImagem(Buffer.alloc(5 * 1024 * 1024 + 1))).rejects.toMatchObject({
      status: 400,
      body: { message: 'Arquivo maior que 5 MB' },
    })
  })

  it('conteúdo que não é imagem responde 400', async () => {
    const erro = await processarImagem(Buffer.from('não sou imagem')).catch((e) => e)
    expect(erro).toBeInstanceOf(HttpError)
    expect(erro.body).toEqual({ message: 'Arquivo de imagem inválido' })
  })

  it('formato fora da lista (SVG) responde 400', async () => {
    await expect(processarImagem(svg)).rejects.toMatchObject({ status: 400, body: { message: 'Arquivo de imagem inválido' } })
  })

  it('imagem truncada responde 400', async () => {
    await expect(processarImagem(jpegGrande.subarray(0, 200))).rejects.toMatchObject({ status: 400 })
  })
})

describe('caminhoSeguro', () => {
  it('monta pasta/dono/sub/uuid.webp em minúsculas', () => {
    expect(caminhoSeguro('veterinarios', DONO.toUpperCase(), ['locais', OUTRO])).toBe(
      `veterinarios/${DONO}/locais/${OUTRO}/uuid-fixo.webp`
    )
  })

  it.each(['../x', 'abc', '', `${DONO}/..`])('rejeita dono que não é UUID: %s', (dono) => {
    expect(() => caminhoSeguro('pets', dono)).toThrow('Id do dono inválido')
  })

  it.each(['..', 'a/b', 'A', 'x'.repeat(65), ''])('rejeita segmento inválido: %s', (sub) => {
    expect(() => caminhoSeguro('pets', DONO, [sub])).toThrow('Segmento de caminho inválido')
  })

  it('rejeita pasta desconhecida', () => {
    expect(() => caminhoSeguro('legado' as never, DONO)).toThrow('Pasta de storage inválida')
  })
})

describe('uploadPhoto', () => {
  it('envia WebP sem sobrescrever e devolve a URL pública', async () => {
    const r = await uploadPhoto('pets', DONO, arquivo())
    expect(r).toEqual({ key: `pets/${DONO}/uuid-fixo.webp`, url: `${PUBLICO}/pets/${DONO}/uuid-fixo.webp` })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/storage/v1/object/lincepet-media/pets/${DONO}/uuid-fixo.webp`)
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      apikey: SEGREDO,
      Authorization: `Bearer ${SEGREDO}`,
      'Content-Type': 'image/webp',
      'x-upsert': 'false',
    })
    expect((await sharp(Buffer.from(init.body)).metadata()).format).toBe('webp')
  })

  it('usa SUPABASE_STORAGE_BUCKET quando definido', async () => {
    vi.stubEnv('SUPABASE_STORAGE_BUCKET', 'outro-bucket')
    const r = await uploadPhoto('pets', DONO, arquivo())
    expect(r.url).toBe(`${BASE}/storage/v1/object/public/outro-bucket/pets/${DONO}/uuid-fixo.webp`)
  })

  it('extensão incompatível responde 400 sem chamar o storage', async () => {
    await expect(uploadPhoto('pets', DONO, arquivo(png, 'script.svg'))).rejects.toMatchObject({ status: 400 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('aceita nome sem extensão (o conteúdo é validado pelo sharp)', async () => {
    await expect(uploadPhoto('pets', DONO, arquivo(png, 'foto'))).resolves.toMatchObject({ key: `pets/${DONO}/uuid-fixo.webp` })
  })

  it('conteúdo inválido não chega ao storage', async () => {
    await expect(uploadPhoto('pets', DONO, arquivo(Buffer.from('x'), 'a.png'))).rejects.toMatchObject({ status: 400 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dono inválido (path traversal) não chega ao storage', async () => {
    await expect(uploadPhoto('pets', '../../etc', arquivo())).rejects.toThrow('Id do dono inválido')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sem configuração do Supabase lança erro', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    await expect(uploadPhoto('pets', DONO, arquivo())).rejects.toThrow('Supabase Storage não configurado')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SEGREDO)
    vi.stubEnv('SUPABASE_URL', '')
    await expect(uploadPhoto('pets', DONO, arquivo())).rejects.toThrow('Supabase Storage não configurado')
  })

  it('falha do Supabase gera erro e log sem a chave', async () => {
    fetchMock.mockResolvedValueOnce(resposta(409))
    await expect(uploadPhoto('pets', DONO, arquivo())).rejects.toThrow('Falha no upload para o storage (HTTP 409)')
    const log = JSON.stringify((console.error as unknown as ReturnType<typeof vi.fn>).mock.calls)
    expect(log).toContain('req-1')
    expect(log).not.toContain(SEGREDO)
  })

  it('atalhos usam a pasta e a subpasta certas', async () => {
    expect((await uploadVeterinarioPhoto(DONO, arquivo())).key).toBe(`veterinarios/${DONO}/perfil/uuid-fixo.webp`)
    expect((await uploadVeterinarioPhoto(DONO, arquivo(), ['uploads'])).key).toBe(`veterinarios/${DONO}/uploads/uuid-fixo.webp`)
    expect((await uploadPetPhoto(DONO, arquivo())).key).toBe(`pets/${DONO}/uuid-fixo.webp`)
    expect((await uploadTutorPhoto(DONO, arquivo())).key).toBe(`tutores/${DONO}/uuid-fixo.webp`)
    expect((await uploadClinicaPhoto(DONO, arquivo())).key).toBe(`clinicas/${DONO}/perfil/uuid-fixo.webp`)
    expect((await uploadClinicaPhoto(DONO, arquivo(), 'capa')).key).toBe(`clinicas/${DONO}/capa/uuid-fixo.webp`)
    expect((await uploadPrestadorPhoto(DONO, arquivo())).key).toBe(`prestadores/${DONO}/uuid-fixo.webp`)
  })
})

describe('chaveDoBucket', () => {
  it('extrai a chave de URL do nosso bucket', () => {
    expect(chaveDoBucket(`${PUBLICO}/pets/${DONO}/a.webp`)).toBe(`pets/${DONO}/a.webp`)
    expect(chaveDoBucket(`${PUBLICO}/pets/${DONO}/a.webp?t=1`)).toBe(`pets/${DONO}/a.webp`)
    expect(chaveDoBucket(`${PUBLICO}/legado/pets/a.jpeg`)).toBe('legado/pets/a.jpeg')
  })

  it.each([
    null,
    undefined,
    '',
    'https://d261ftrvo5a2p7.cloudfront.net/pets/a.jpeg',
    'https://bucket.s3.sa-east-1.amazonaws.com/pets/a.png',
    'https://outro.supabase.co/storage/v1/object/public/lincepet-media/pets/a.webp',
    `${BASE}/storage/v1/object/public/outro-bucket/pets/a.webp`,
    `${PUBLICO}/pets/..%2F..%2Fx.webp`,
    `${PUBLICO}/segredos/a.webp`,
    `${PUBLICO}/pets/%E0%A4%A.webp`,
  ])('ignora URL que não é nossa: %s', (url) => {
    expect(chaveDoBucket(url)).toBeNull()
  })

  it('sem SUPABASE_URL não reconhece nada', () => {
    vi.stubEnv('SUPABASE_URL', '')
    expect(chaveDoBucket(`${PUBLICO}/pets/${DONO}/a.webp`)).toBeNull()
  })
})

describe('fotoDoCliente', () => {
  const recusa = (valor: unknown) => {
    try {
      fotoDoCliente(valor)
    } catch (e) {
      return e
    }
    throw new Error(`aceitou ${JSON.stringify(valor)}`)
  }

  it.each([undefined, null, ''])('%j significa sem foto', (valor) => {
    expect(fotoDoCliente(valor)).toBeNull()
  })

  it('devolve a URL do nosso bucket sem espaços nas pontas', () => {
    const url = `${PUBLICO}/pets/${DONO}/a.webp`
    expect(fotoDoCliente(`  ${url}\n`)).toBe(url)
  })

  it.each([
    ['externa', 'https://exemplo.com/a.png'],
    ['da AWS', 'https://d261ftrvo5a2p7.cloudfront.net/pets/a.jpeg'],
    ['só espaços', '   '],
    ['número', 123],
    ['objeto', { url: `${PUBLICO}/pets/${DONO}/a.webp` }],
    ['array', [`${PUBLICO}/pets/${DONO}/a.webp`]],
  ])('URL %s responde 400 com a mensagem para o usuário', (_, valor) => {
    const erro = recusa(valor)
    expect(erro).toBeInstanceOf(HttpError)
    expect((erro as HttpError).status).toBe(400)
    expect((erro as HttpError).body).toEqual({ message: 'A foto precisa ser enviada pelo upload da Lince Pet' })
  })
})

describe('deleteObject', () => {
  it('envia DELETE com a chave', async () => {
    await deleteObject(`pets/${DONO}/a.webp`)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/storage/v1/object/lincepet-media/pets/${DONO}/a.webp`)
    expect(init.method).toBe('DELETE')
  })

  it('404 é tratado como já removido', async () => {
    fetchMock.mockResolvedValueOnce(resposta(404))
    await expect(deleteObject(`pets/${DONO}/a.webp`)).resolves.toBeUndefined()
  })

  it('outro erro do Supabase é propagado', async () => {
    fetchMock.mockResolvedValueOnce(resposta(500))
    await expect(deleteObject(`pets/${DONO}/a.webp`)).rejects.toThrow('Falha ao remover do storage (HTTP 500)')
  })

  it.each(['../x.webp', 'segredos/a.webp', 'pets/../a.webp'])('recusa chave fora do padrão: %s', async (key) => {
    await expect(deleteObject(key)).rejects.toThrow('Chave de storage inválida')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('confirmarUpload', () => {
  const novo = { key: `pets/${DONO}/novo.webp`, url: `${PUBLICO}/pets/${DONO}/novo.webp` }
  const deletes = () => fetchMock.mock.calls.filter(([, init]) => init.method === 'DELETE').map(([url]) => url as string)

  it('grava e apaga só as fotos anteriores do nosso bucket que não estão em uso', async () => {
    const r = await confirmarUpload(novo, async () => 'ok', {
      anteriores: [
        `${PUBLICO}/pets/${DONO}/velha.webp`,
        `${PUBLICO}/pets/${DONO}/velha.webp`,
        `${PUBLICO}/pets/${DONO}/capa.webp`,
        `${PUBLICO}/legado/pets/a.jpeg`,
        'https://d261ftrvo5a2p7.cloudfront.net/pets/a.jpeg',
        novo.url,
        null,
      ],
      emUso: [`${PUBLICO}/pets/${DONO}/capa.webp`],
    })
    expect(r).toBe('ok')
    expect(deletes()).toEqual([`${BASE}/storage/v1/object/lincepet-media/pets/${DONO}/velha.webp`])
  })

  it('não apaga foto de outro dono mesmo que a URL anterior aponte para ela', async () => {
    const outroDono = '99999999-2222-4333-8444-555555555555'
    await confirmarUpload(novo, async () => 'ok', {
      anteriores: [`${PUBLICO}/pets/${outroDono}/da-vitima.webp`, `${PUBLICO}/clinicas/${DONO}/perfil/x.webp`],
    })
    expect(deletes()).toEqual([])
  })

  it('sem opções só grava', async () => {
    await confirmarUpload(novo, async () => 1)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('se a gravação falhar, apaga o objeto novo e propaga o erro', async () => {
    await expect(confirmarUpload(novo, async () => Promise.reject(new Error('db fora')))).rejects.toThrow('db fora')
    expect(deletes()).toEqual([`${BASE}/storage/v1/object/lincepet-media/pets/${DONO}/novo.webp`])
  })

  it('falha ao apagar não derruba a operação (só registra)', async () => {
    fetchMock.mockResolvedValue(resposta(500))
    await expect(
      confirmarUpload(novo, async () => 'ok', { anteriores: [`${PUBLICO}/pets/${DONO}/velha.webp`] })
    ).resolves.toBe('ok')
    fetchMock.mockRejectedValue('rede')
    await expect(
      confirmarUpload(novo, async () => 'ok', { anteriores: [`${PUBLICO}/pets/${DONO}/velha.webp`] })
    ).resolves.toBe('ok')
    expect(console.error).toHaveBeenCalledWith('[storage] objeto não removido', expect.objectContaining({ key: `pets/${DONO}/velha.webp` }))
  })
})

describe('toStorageFile', () => {
  it('converte o arquivo do request', async () => {
    const buf = Buffer.from('abc')
    expect(await toStorageFile({ buffer: async () => buf, clientName: 'a.png', type: 'image/png' })).toEqual({
      buffer: buf,
      originalname: 'a.png',
      mimetype: 'image/png',
    })
  })

  it('tipo vazio vira application/octet-stream', async () => {
    const r = await toStorageFile({ buffer: async () => Buffer.from(''), clientName: 'a', type: '' })
    expect(r.mimetype).toBe('application/octet-stream')
  })
})
