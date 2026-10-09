import 'server-only'
import { prisma } from '../db'
import { HttpError, type ApiRequest, type UploadedFile } from '../http'

export async function requireTutorOf(userId: string) {
  const tutor = await prisma.tutor.findFirst({ where: { userId } })
  if (!tutor) throw new HttpError(400, { message: 'Usuário não é um tutor válido' })
  return tutor
}

export async function requireTutorPet(tutorId: string, petId: string) {
  const pet = await prisma.pet.findFirst({ where: { id: petId, tutorId } })
  if (!pet) throw new HttpError(404, { message: 'Pet não encontrado' })
  return pet
}

export const isMultipart = (req: ApiRequest) => (req.header('content-type') || '').includes('multipart/form-data')

export const PHOTO_OPTIONS = { size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }

/** Primeiro arquivo presente entre as chaves aceitas (mesma ordem do `||` do Adonis). */
export function firstFile(req: ApiRequest, keys: string[]): UploadedFile | null {
  for (const key of keys) {
    const file = req.file(key, PHOTO_OPTIONS)
    if (file) return file
  }
  return null
}

export async function toPhotoUpload(file: UploadedFile) {
  return {
    buffer: await file.buffer(),
    originalname: file.clientName || 'photo.jpg',
    mimetype: file.type || 'image/jpeg',
  }
}
