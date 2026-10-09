import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  tutor: { findFirst: vi.fn() },
  pet: { findFirst: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import { HttpError, UploadedFile, type ApiRequest } from '@/server/http'
import { requireTutorOf, requireTutorPet, isMultipart, firstFile, toPhotoUpload, PHOTO_OPTIONS } from '@/server/services/pets'

const fakeReq = (opts: { contentType?: string | null; files?: Record<string, UploadedFile> } = {}) => {
  const file = vi.fn((key: string) => opts.files?.[key] ?? null)
  const req = { header: vi.fn(() => opts.contentType ?? null), file } as unknown as ApiRequest
  return { req, file }
}

beforeEach(() => vi.clearAllMocks())

describe('requireTutorOf', () => {
  it('devolve o tutor do usuário', async () => {
    prismaMock.tutor.findFirst.mockResolvedValueOnce({ id: 'tutor-1' })
    await expect(requireTutorOf('user-1')).resolves.toEqual({ id: 'tutor-1' })
    expect(prismaMock.tutor.findFirst).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
  })

  it('usuário sem tutor: 400', async () => {
    prismaMock.tutor.findFirst.mockResolvedValueOnce(null)
    const erro = await requireTutorOf('user-1').catch((e) => e)
    expect(erro).toBeInstanceOf(HttpError)
    expect(erro.status).toBe(400)
    expect(erro.body).toEqual({ message: 'Usuário não é um tutor válido' })
  })
})

describe('requireTutorPet', () => {
  it('só encontra o pet do próprio tutor', async () => {
    prismaMock.pet.findFirst.mockResolvedValueOnce({ id: 'pet-1', tutorId: 'tutor-1' })
    await expect(requireTutorPet('tutor-1', 'pet-1')).resolves.toMatchObject({ id: 'pet-1' })
    expect(prismaMock.pet.findFirst).toHaveBeenCalledWith({ where: { id: 'pet-1', tutorId: 'tutor-1' } })
  })

  it('pet de outro tutor ou inexistente: 404', async () => {
    prismaMock.pet.findFirst.mockResolvedValueOnce(null)
    const erro = await requireTutorPet('tutor-1', 'pet-x').catch((e) => e)
    expect(erro).toBeInstanceOf(HttpError)
    expect(erro.status).toBe(404)
    expect(erro.message).toBe('Pet não encontrado')
  })
})

describe('isMultipart', () => {
  it('detecta multipart/form-data e trata header ausente', () => {
    expect(isMultipart(fakeReq({ contentType: 'multipart/form-data; boundary=x' }).req)).toBe(true)
    expect(isMultipart(fakeReq({ contentType: 'application/json' }).req)).toBe(false)
    expect(isMultipart(fakeReq({ contentType: null }).req)).toBe(false)
  })
})

describe('firstFile', () => {
  it('devolve o primeiro arquivo presente na ordem das chaves, com as opções de foto', () => {
    const foto = new UploadedFile('photo', new File(['x'], 'a.png', { type: 'image/png' }))
    const { req, file } = fakeReq({ files: { photo: foto } })
    expect(firstFile(req, ['foto', 'photo', 'image'])).toBe(foto)
    expect(file).toHaveBeenNthCalledWith(1, 'foto', PHOTO_OPTIONS)
    expect(file).toHaveBeenNthCalledWith(2, 'photo', PHOTO_OPTIONS)
    expect(file).toHaveBeenCalledTimes(2)
  })

  it('nenhum arquivo: null', () => {
    expect(firstFile(fakeReq().req, ['foto', 'photo'])).toBeNull()
  })

  it('aceita até 5mb e só extensões de imagem', () => {
    expect(PHOTO_OPTIONS).toEqual({ size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp', 'gif'] })
  })
})

describe('toPhotoUpload', () => {
  it('converte o arquivo para o formato do storage', async () => {
    const f = new UploadedFile('foto', new File(['conteudo'], 'gato.webp', { type: 'image/webp' }))
    const up = await toPhotoUpload(f)
    expect(up.originalname).toBe('gato.webp')
    expect(up.mimetype).toBe('image/webp')
    expect(up.buffer.toString()).toBe('conteudo')
  })

  it('sem nome nem tipo usa photo.jpg e image/jpeg', async () => {
    const up = await toPhotoUpload(new UploadedFile('foto', new File(['x'], '')))
    expect(up.originalname).toBe('photo.jpg')
    expect(up.mimetype).toBe('image/jpeg')
  })
})
