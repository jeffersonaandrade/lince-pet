import 'server-only'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../env'

/**
 * Laudos em PDF num bucket PRIVADO (sem URL pública): só o backend grava, com a service role, e quem pode ver o
 * prontuário recebe uma URL assinada de 60 s. Em dev/e2e, `LAUDOS_STORAGE_DIR` + `LAUDOS_STORAGE_SECRET` trocam
 * o Supabase por uma pasta local com link HMAC (nunca em produção).
 */

export const TAMANHO_MAXIMO_LAUDO = 10 * 1024 * 1024
export const VALIDADE_URL_S = 60
const TIMEOUT_MS = 30_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CHAVE = /^clinicas\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/i

/** Começa com `%PDF-`: o MIME e a extensão vêm do navegador e não bastam. */
export const ehPdf = (buffer: Buffer) => buffer.length > 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-'

/** `clinicas/{clinicaId}/{agendamentoId}/{uuid}.pdf`: nada do cliente entra no caminho. */
export function chaveDoLaudo(clinicaId: string, agendamentoId: string) {
  if (!UUID.test(clinicaId) || !UUID.test(agendamentoId)) throw new Error('Id inválido para o laudo')
  return `clinicas/${clinicaId.toLowerCase()}/${agendamentoId.toLowerCase()}/${randomUUID()}.pdf`
}

const chaveValida = (key: string) => CHAVE.test(key) && !key.includes('..')

function local() {
  const dir = env('LAUDOS_STORAGE_DIR')
  if (!dir) return null
  if (process.env.NODE_ENV === 'production') throw new Error('LAUDOS_STORAGE_DIR não pode ser usado em produção')
  const segredo = env('LAUDOS_STORAGE_SECRET')
  if (!segredo) throw new Error('LAUDOS_STORAGE_SECRET é obrigatório com LAUDOS_STORAGE_DIR')
  return { dir: path.resolve(dir), segredo }
}

function supabase() {
  const url = env('SUPABASE_URL')
  const chave = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !chave) throw new Error('Supabase Storage não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  return { base: url.replace(/\/+$/, ''), chave, bucket: env('SUPABASE_LAUDOS_BUCKET') || 'lincepet-laudos' }
}

export async function salvarLaudo(key: string, pdf: Buffer) {
  if (!chaveValida(key)) throw new Error('Chave de laudo inválida')
  const l = local()
  if (l) {
    const destino = path.join(l.dir, key)
    await mkdir(path.dirname(destino), { recursive: true })
    await writeFile(destino, pdf)
    return
  }
  const { base, chave, bucket } = supabase()
  const res = await fetch(`${base}/storage/v1/object/${bucket}/${key}`, {
    method: 'POST',
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
    body: new Uint8Array(pdf),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    console.error('[laudos] falha no upload', { status: res.status, key, requestId: res.headers.get('sb-request-id') })
    throw new Error(`Falha no upload do laudo (HTTP ${res.status})`)
  }
}

export async function removerLaudo(key: string) {
  if (!chaveValida(key)) return
  try {
    const l = local()
    if (l) {
      await rm(path.join(l.dir, key), { force: true })
      return
    }
    const { base, chave, bucket } = supabase()
    await fetch(`${base}/storage/v1/object/${bucket}/${key}`, {
      method: 'DELETE',
      headers: { apikey: chave, Authorization: `Bearer ${chave}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    console.error('[laudos] laudo anterior não removido', { key, erro: error instanceof Error ? error.message : String(error) })
  }
}

const assinar = (segredo: string, key: string, expira: number) =>
  createHmac('sha256', segredo).update(`${key}:${expira}`).digest('hex')

/** URL que expira em 60 s. */
export async function urlAssinadaDoLaudo(key: string) {
  if (!chaveValida(key)) throw new Error('Chave de laudo inválida')
  const l = local()
  if (l) {
    const expira = Math.floor(Date.now() / 1000) + VALIDADE_URL_S
    const q = new URLSearchParams({ k: key, e: String(expira), s: assinar(l.segredo, key, expira) })
    return `/api/exames/laudos/local?${q}`
  }
  const { base, chave, bucket } = supabase()
  const res = await fetch(`${base}/storage/v1/object/sign/${bucket}/${key}`, {
    method: 'POST',
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: VALIDADE_URL_S }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const corpo = (await res.json().catch(() => null)) as { signedURL?: string } | null
  if (!res.ok || !corpo?.signedURL) {
    console.error('[laudos] falha ao assinar', { status: res.status, key })
    throw new Error(`Falha ao gerar o link do laudo (HTTP ${res.status})`)
  }
  return `${base}/storage/v1${corpo.signedURL}`
}

/** Driver local: confere a assinatura e devolve o PDF; null se inválido ou expirado. */
export async function lerLaudoLocal(key: string, expira: number, assinatura: string) {
  const l = local()
  if (!l || !chaveValida(key) || !Number.isFinite(expira) || expira < Date.now() / 1000) return null
  const esperado = Buffer.from(assinar(l.segredo, key, expira))
  const recebido = Buffer.from(assinatura)
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null
  try {
    return await readFile(path.join(l.dir, key))
  } catch {
    return null
  }
}
