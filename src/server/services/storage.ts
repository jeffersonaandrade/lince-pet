import 'server-only'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'
import { env } from '../env'

export type StorageFile = { buffer: Buffer; originalname: string; mimetype: string }
export type StorageFolder = 'veterinarios' | 'pets' | 'tutores' | 'clinicas' | 'prestadores'

let client: S3Client | null = null
const s3 = () => (client ??= new S3Client({ region: region() }))
const region = () => env('AWS_REGION') || env('AWS_DEFAULT_REGION')
const bucket = () => env('S3_BUCKET_NAME')

function publicBaseUrl() {
  const configured = env('S3_PUBLIC_BASE_URL')
  const base = configured
    ? configured.startsWith('http')
      ? configured
      : `https://${configured}`
    : `https://${bucket()}.s3.${region()}.amazonaws.com`
  return base.replace(/\/+$/, '')
}

export async function uploadPhoto(folder: StorageFolder, file: StorageFile) {
  const Bucket = bucket()
  if (!Bucket) throw new Error('S3 bucket not configured')

  const extension = file.originalname.split('.').pop() || ''
  const key = `${folder}/${randomUUID()}.${extension}`
  await s3().send(new PutObjectCommand({ Bucket, Key: key, Body: file.buffer, ContentType: file.mimetype }))
  return { url: `${publicBaseUrl()}/${key}`, key }
}

export const uploadVeterinarioPhoto = (file: StorageFile) => uploadPhoto('veterinarios', file)
export const uploadPetPhoto = (file: StorageFile) => uploadPhoto('pets', file)
export const uploadTutorPhoto = (file: StorageFile) => uploadPhoto('tutores', file)
export const uploadClinicaPhoto = (file: StorageFile) => uploadPhoto('clinicas', file)
export const uploadPrestadorPhoto = (file: StorageFile) => uploadPhoto('prestadores', file)

export async function deleteObject(key: string) {
  const Bucket = bucket()
  if (!Bucket) return
  await s3().send(new DeleteObjectCommand({ Bucket, Key: key }))
}

/** Converte o arquivo do request no formato esperado pelo upload. */
export async function toStorageFile(file: { buffer(): Promise<Buffer>; clientName: string; type: string }) {
  return { buffer: await file.buffer(), originalname: file.clientName, mimetype: file.type || 'application/octet-stream' }
}
