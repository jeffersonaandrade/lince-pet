import 'server-only'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { env } from '../env'
import { HttpError } from '../http'

export type StorageFile = { buffer: Buffer; originalname: string; mimetype: string }
export type StorageFolder = 'veterinarios' | 'pets' | 'tutores' | 'clinicas' | 'prestadores'
export type UploadResult = { url: string; key: string }

export const TAMANHO_MAXIMO = 5 * 1024 * 1024
const LADO_MAXIMO = 1600
const LIMITE_PIXELS = 40_000_000
const QUALIDADE_WEBP = 82
const TIMEOUT_MS = 15_000
const EXTENSOES = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
const FORMATOS = new Set(['jpeg', 'png', 'webp', 'gif'])
const PASTAS = new Set<StorageFolder>(['veterinarios', 'pets', 'tutores', 'clinicas', 'prestadores'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SEGMENTO = /^[a-z0-9-]+$/
const CHAVE_NOSSA = /^(?:veterinarios|pets|tutores|clinicas|prestadores|legado)(?:\/[a-z0-9-]+)+\.[a-z0-9]+$/i

const imagemInvalida = () => new HttpError(400, { message: 'Arquivo de imagem inválido' })

function config() {
  const url = env('SUPABASE_URL')
  const chave = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !chave) throw new Error('Supabase Storage não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  return { base: url.replace(/\/+$/, ''), chave, bucket: env('SUPABASE_STORAGE_BUCKET') || 'lincepet-media' }
}

const urlPublica = (base: string, bucket: string, key: string) => `${base}/storage/v1/object/public/${bucket}/${key}`

/** Decodifica a imagem de verdade (ignora o MIME do navegador) e normaliza para WebP sem metadados (EXIF/GPS). */
export async function processarImagem(buffer: Buffer): Promise<Buffer> {
  if (!buffer?.length) throw new HttpError(400, { message: 'Arquivo vazio' })
  if (buffer.length > TAMANHO_MAXIMO) throw new HttpError(400, { message: 'Arquivo maior que 5 MB' })

  const opcoes = { limitInputPixels: LIMITE_PIXELS, failOn: 'error' as const }
  try {
    const { format } = await sharp(buffer, opcoes).metadata()
    if (!format || !FORMATOS.has(format)) throw imagemInvalida()
    return await sharp(buffer, opcoes)
      .rotate()
      .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALIDADE_WEBP })
      .toBuffer()
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw imagemInvalida()
  }
}

/** Monta `pasta/donoId/sub.../uuid.webp`. O dono vem do banco/sessão; nada do cliente entra no caminho. */
export function caminhoSeguro(pasta: StorageFolder, donoId: string, sub: string[] = []) {
  if (!PASTAS.has(pasta)) throw new Error(`Pasta de storage inválida: ${pasta}`)
  if (!UUID.test(donoId)) throw new Error('Id do dono inválido para o storage')
  for (const s of sub) {
    if (!SEGMENTO.test(s) || s.length > 64) throw new Error('Segmento de caminho inválido para o storage')
  }
  return [pasta, donoId.toLowerCase(), ...sub, `${randomUUID()}.webp`].join('/')
}

function extensao(nome: string) {
  const i = nome.lastIndexOf('.')
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : ''
}

export async function uploadPhoto(pasta: StorageFolder, donoId: string, file: StorageFile, sub: string[] = []): Promise<UploadResult> {
  const ext = extensao(file.originalname || '')
  if (ext && !EXTENSOES.has(ext)) throw new HttpError(400, { message: `Extensão ${ext} não permitida` })

  const key = caminhoSeguro(pasta, donoId, sub)
  const { base, chave, bucket } = config()
  const corpo = await processarImagem(file.buffer)

  const res = await fetch(`${base}/storage/v1/object/${bucket}/${key}`, {
    method: 'POST',
    headers: {
      apikey: chave,
      Authorization: `Bearer ${chave}`,
      'Content-Type': 'image/webp',
      'cache-control': 'max-age=31536000',
      'x-upsert': 'false',
    },
    body: new Uint8Array(corpo),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    console.error('[storage] falha no upload', { status: res.status, key, requestId: res.headers.get('sb-request-id') })
    throw new Error(`Falha no upload para o storage (HTTP ${res.status})`)
  }
  return { url: urlPublica(base, bucket, key), key }
}

export const uploadVeterinarioPhoto = (veterinarioId: string, file: StorageFile, sub: string[] = ['perfil']) =>
  uploadPhoto('veterinarios', veterinarioId, file, sub)
export const uploadPetPhoto = (petId: string, file: StorageFile) => uploadPhoto('pets', petId, file)
export const uploadTutorPhoto = (userId: string, file: StorageFile) => uploadPhoto('tutores', userId, file)
export const uploadClinicaPhoto = (clinicaId: string, file: StorageFile, tipo: 'perfil' | 'capa' = 'perfil') =>
  uploadPhoto('clinicas', clinicaId, file, [tipo])
export const uploadPrestadorPhoto = (prestadorId: string, file: StorageFile) => uploadPhoto('prestadores', prestadorId, file)

/** Chave do objeto se a URL for do nosso bucket; `null` para URL externa, da AWS ou malformada. */
export function chaveDoBucket(url: string | null | undefined): string | null {
  if (!url) return null
  const supabaseUrl = env('SUPABASE_URL')
  if (!supabaseUrl) return null
  const prefixo = urlPublica(supabaseUrl.replace(/\/+$/, ''), env('SUPABASE_STORAGE_BUCKET') || 'lincepet-media', '')
  if (!url.startsWith(prefixo)) return null
  let key: string
  try {
    key = decodeURIComponent(url.slice(prefixo.length).split(/[?#]/)[0])
  } catch {
    return null
  }
  return CHAVE_NOSSA.test(key) && !key.includes('..') ? key : null
}

export async function deleteObject(key: string) {
  if (!CHAVE_NOSSA.test(key) || key.includes('..')) throw new Error('Chave de storage inválida')
  const { base, chave, bucket } = config()
  const res = await fetch(`${base}/storage/v1/object/${bucket}/${key}`, {
    method: 'DELETE',
    headers: { apikey: chave, Authorization: `Bearer ${chave}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok && res.status !== 404) {
    console.error('[storage] falha ao remover', { status: res.status, key, requestId: res.headers.get('sb-request-id') })
    throw new Error(`Falha ao remover do storage (HTTP ${res.status})`)
  }
}

async function removerSemFalhar(key: string) {
  try {
    await deleteObject(key)
  } catch (error) {
    console.error('[storage] objeto não removido', { key, erro: error instanceof Error ? error.message : String(error) })
  }
}

type ConfirmarOpcoes = {
  /** URLs que a gravação substitui; só as do nosso bucket (fora de `legado/`) são apagadas. */
  anteriores?: (string | null | undefined)[]
  /** URLs que continuam referenciadas em outras colunas e não podem ser apagadas. */
  emUso?: (string | null | undefined)[]
}

/**
 * Grava a URL no banco depois do upload. Se a gravação falhar, apaga o objeto recém-enviado;
 * se der certo, apaga as fotos anteriores que eram nossas e não estão mais em uso.
 */
export async function confirmarUpload<T>(resultado: UploadResult, gravar: () => Promise<T>, opcoes: ConfirmarOpcoes = {}) {
  let retorno: T
  try {
    retorno = await gravar()
  } catch (error) {
    await removerSemFalhar(resultado.key)
    throw error
  }
  const emUso = new Set([resultado.url, ...(opcoes.emUso ?? [])])
  const chaves = new Set(
    (opcoes.anteriores ?? [])
      .filter((url) => url && !emUso.has(url))
      .map((url) => chaveDoBucket(url))
      .filter((key): key is string => !!key && !key.startsWith('legado/'))
  )
  for (const key of chaves) await removerSemFalhar(key)
  return retorno
}

/** Converte o arquivo do request no formato esperado pelo upload. */
export async function toStorageFile(file: { buffer(): Promise<Buffer>; clientName: string; type: string }) {
  return { buffer: await file.buffer(), originalname: file.clientName, mimetype: file.type || 'application/octet-stream' }
}
