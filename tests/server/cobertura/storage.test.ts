import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const s3 = vi.hoisted(() => ({ send: vi.fn(), configs: [] as unknown[] }))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = s3.send
    constructor(config: unknown) {
      s3.configs.push(config)
    }
  },
  PutObjectCommand: class {
    tipo = 'put'
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    tipo = 'delete'
    constructor(public input: unknown) {}
  },
}))
vi.mock('node:crypto', () => ({ randomUUID: () => 'uuid-fixo' }))

import {
  deleteObject,
  toStorageFile,
  uploadClinicaPhoto,
  uploadPetPhoto,
  uploadPhoto,
  uploadPrestadorPhoto,
  uploadTutorPhoto,
  uploadVeterinarioPhoto,
} from '@/server/services/storage'

const arquivo = (originalname = 'foto.png') => ({ buffer: Buffer.from('x'), originalname, mimetype: 'image/png' })

beforeEach(() => {
  s3.send.mockReset()
  s3.send.mockResolvedValue({})
  vi.stubEnv('S3_BUCKET_NAME', 'bucket-teste')
  vi.stubEnv('AWS_REGION', 'sa-east-1')
  vi.stubEnv('AWS_DEFAULT_REGION', '')
  vi.stubEnv('S3_PUBLIC_BASE_URL', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('uploadPhoto', () => {
  it('sem bucket configurado lança erro e não envia nada', async () => {
    vi.stubEnv('S3_BUCKET_NAME', '')
    await expect(uploadPhoto('pets', arquivo())).rejects.toThrow('S3 bucket not configured')
    expect(s3.send).not.toHaveBeenCalled()
  })

  it('envia PutObject com chave pasta/uuid.ext e devolve URL padrão do S3', async () => {
    const r = await uploadPhoto('pets', arquivo())
    expect(r).toEqual({ key: 'pets/uuid-fixo.png', url: 'https://bucket-teste.s3.sa-east-1.amazonaws.com/pets/uuid-fixo.png' })
    const cmd = s3.send.mock.calls[0][0]
    expect(cmd.tipo).toBe('put')
    expect(cmd.input).toMatchObject({ Bucket: 'bucket-teste', Key: 'pets/uuid-fixo.png', ContentType: 'image/png' })
    expect(s3.configs[0]).toEqual({ region: 'sa-east-1' })
  })

  it('reaproveita o mesmo client S3 entre chamadas', async () => {
    const antes = s3.configs.length
    await uploadPhoto('pets', arquivo())
    await uploadPhoto('pets', arquivo())
    expect(s3.configs.length).toBe(antes)
  })

  it('usa S3_PUBLIC_BASE_URL com protocolo e remove barras finais', async () => {
    vi.stubEnv('S3_PUBLIC_BASE_URL', 'https://cdn.lince.pet///')
    expect((await uploadPhoto('tutores', arquivo('a.jpg'))).url).toBe('https://cdn.lince.pet/tutores/uuid-fixo.jpg')
  })

  it('S3_PUBLIC_BASE_URL sem protocolo ganha https://', async () => {
    vi.stubEnv('S3_PUBLIC_BASE_URL', 'cdn.lince.pet/')
    expect((await uploadPhoto('clinicas', arquivo('a.jpg'))).url).toBe('https://cdn.lince.pet/clinicas/uuid-fixo.jpg')
  })

  it('usa AWS_DEFAULT_REGION quando AWS_REGION não existe', async () => {
    vi.stubEnv('AWS_REGION', '')
    vi.stubEnv('AWS_DEFAULT_REGION', 'us-east-1')
    expect((await uploadPhoto('pets', arquivo())).url).toBe('https://bucket-teste.s3.us-east-1.amazonaws.com/pets/uuid-fixo.png')
  })

  it('nome terminado em ponto gera chave sem extensão', async () => {
    expect((await uploadPhoto('pets', arquivo('foto.'))).key).toBe('pets/uuid-fixo.')
  })

  it('propaga falha do S3', async () => {
    s3.send.mockRejectedValueOnce(new Error('AccessDenied'))
    await expect(uploadPhoto('pets', arquivo())).rejects.toThrow('AccessDenied')
  })

  it('atalhos por pasta usam a pasta certa', async () => {
    expect((await uploadVeterinarioPhoto(arquivo())).key).toMatch(/^veterinarios\//)
    expect((await uploadPetPhoto(arquivo())).key).toMatch(/^pets\//)
    expect((await uploadTutorPhoto(arquivo())).key).toMatch(/^tutores\//)
    expect((await uploadClinicaPhoto(arquivo())).key).toMatch(/^clinicas\//)
    expect((await uploadPrestadorPhoto(arquivo())).key).toMatch(/^prestadores\//)
  })
})

describe('deleteObject', () => {
  it('envia DeleteObject com bucket e chave', async () => {
    await deleteObject('pets/x.png')
    const cmd = s3.send.mock.calls[0][0]
    expect(cmd.tipo).toBe('delete')
    expect(cmd.input).toEqual({ Bucket: 'bucket-teste', Key: 'pets/x.png' })
  })

  it('sem bucket não faz nada', async () => {
    vi.stubEnv('S3_BUCKET_NAME', '')
    await expect(deleteObject('pets/x.png')).resolves.toBeUndefined()
    expect(s3.send).not.toHaveBeenCalled()
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
