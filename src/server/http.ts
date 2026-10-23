import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { errors as vineErrors } from '@vinejs/vine'
import { serialize } from './lucid'
import { AUTH_COOKIE } from './auth/jwt'

/**
 * Camada HTTP que reproduz o contrato do Adonis (status, corpo e formato de erro),
 * para que o frontend não perceba a troca de backend.
 */

export class HttpError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    public options: { clearAuthCookie?: boolean } = {}
  ) {
    super(typeof body === 'object' && body && 'message' in body ? String(body.message) : `HTTP ${status}`)
  }
}

export function json(data: unknown, status = 200, init?: ResponseInit) {
  if (status === 204) return new NextResponse(null, { status, headers: init?.headers })
  const body = data === undefined ? '' : JSON.stringify(serialize(data))
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new NextResponse(body, { ...init, status, headers })
}

export const ok = (data: unknown) => json(data, 200)
export const created = (data: unknown) => json(data, 201)
export const noContent = () => json(null, 204)
export const badRequest = (data: unknown) => json(data, 400)
export const unauthorized = (data: unknown) => json(data, 401)
export const forbidden = (data: unknown) => json(data, 403)
export const notFound = (data: unknown) => json(data, 404)
export const conflict = (data: unknown) => json(data, 409)
export const unprocessable = (data: unknown) => json(data, 422)
export const serverError = (data: unknown) => json(data, 500)

/** Equivalente ao HttpExceptionHandler do Adonis. */
export function handleError(error: unknown) {
  if (error instanceof HttpError) {
    const res = json(error.body, error.status)
    if (error.options.clearAuthCookie) res.cookies.set(AUTH_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
    return res
  }

  if (error instanceof vineErrors.E_VALIDATION_ERROR) {
    const messages = error.messages as Array<{ message: string }> | undefined
    if (messages?.length) return json({ status: 422, message: messages[0].message }, 422)
  }

  if (error && typeof error === 'object') {
    const err = error as { code?: unknown; messages?: Array<{ message: string }>; status?: unknown; message?: unknown }
    if (err.code === 'E_VALIDATION_ERROR' && err.messages?.length) {
      return json({ status: 422, message: err.messages[0].message }, 422)
    }
    if (typeof err.status === 'number' && 'message' in err) {
      return json({ status: err.status, message: err.message }, err.status)
    }
  }

  console.error('Error: ', error)
  return json({ message: 'Aconteceu um erro inesperado' }, 500)
}

type RouteContext<P> = { params: Promise<P> }

/** Envolve um handler com o tratamento de erro padrão. */
export function route<P = Record<string, string>>(
  fn: (req: NextRequest, params: P) => Promise<Response>
) {
  return async (req: NextRequest, ctx: RouteContext<P>) => {
    try {
      const params = ctx?.params ? await ctx.params : ({} as P)
      return await fn(req, params)
    } catch (error) {
      return handleError(error)
    }
  }
}

/* ------------------------------------------------------------------ */
/* Leitura do request (equivalente a request.all/input/only/file)      */
/* ------------------------------------------------------------------ */

export type FileOptions = { size?: string; extnames?: string[] }

export class UploadedFile {
  errors: { fieldName: string; clientName: string; message: string; type: 'size' | 'extname' }[] = []

  constructor(
    public fieldName: string,
    private file: File
  ) {}

  get clientName() {
    return this.file.name
  }
  get size() {
    return this.file.size
  }
  get type() {
    return this.file.type
  }
  get extname() {
    const parts = this.file.name.split('.')
    return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
  }
  get isValid() {
    return this.errors.length === 0
  }
  async buffer() {
    return Buffer.from(await this.file.arrayBuffer())
  }

  validate(options?: FileOptions) {
    this.errors = []
    const base = { fieldName: this.fieldName, clientName: this.clientName }
    if (options?.size) {
      const limit = parseSize(options.size)
      if (this.size > limit) {
        this.errors.push({ ...base, message: `File size should be less than ${formatBytes(limit)}`, type: 'size' })
      }
    }
    if (options?.extnames?.length && !options.extnames.includes(this.extname)) {
      this.errors.push({
        ...base,
        message: `Invalid file extension ${this.extname}. Only ${options.extnames.join(', ')} are allowed`,
        type: 'extname',
      })
    }
    return this
  }
}

function parseSize(size: string) {
  const match = /^(\d+(?:\.\d+)?)\s*(kb|mb|gb)?$/i.exec(size.trim())
  if (!match) return Number(size)
  const n = Number(match[1])
  const unit = (match[2] || '').toLowerCase()
  return unit === 'gb' ? n * 1024 ** 3 : unit === 'mb' ? n * 1024 ** 2 : unit === 'kb' ? n * 1024 : n
}

/** Mesmo formato do pacote `bytes` usado pelo bodyparser do Adonis (ex.: 5MB, 1.5MB). */
function formatBytes(n: number) {
  const units: [string, number][] = [['GB', 1024 ** 3], ['MB', 1024 ** 2], ['KB', 1024]]
  for (const [unit, size] of units) {
    if (n >= size) return `${Number((n / size).toFixed(2))}${unit}`
  }
  return `${n}B`
}

/** Senha é comparada byte a byte com o hash: espaço nas bordas faz parte dela. */
const CAMPO_SENHA = /senha|password/i

/** Texto digitado sem espaços nas bordas e vazio como `null` (trimWhitespaces + convertEmptyStringsToNull do Adonis). */
function limpar(chave: string, value: unknown): unknown {
  if (typeof value !== 'string') return value
  const limpo = CAMPO_SENHA.test(chave) ? value : value.trim()
  return limpo === '' ? null : limpo
}

function convertEmptyStrings(value: unknown, chave = ''): unknown {
  if (Array.isArray(value)) return value.map((v) => convertEmptyStrings(v, chave))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convertEmptyStrings(v, k)]))
  }
  return limpar(chave, value)
}

/** Monta objeto a partir de chaves estilo `campo[0][sub]` (como o bodyparser do Adonis). */
type Campos = Record<string, unknown>

const CHAVES_PROIBIDAS = new Set(['__proto__', 'constructor', 'prototype'])

function setDeep(target: Campos, key: string, value: unknown) {
  const path = key.replace(/\]/g, '').split('[').filter((p) => p !== '')
  // Sem isto, `?__proto__[x]=y` escreve em Object.prototype e afeta o processo inteiro.
  if (path.some((p) => CHAVES_PROIBIDAS.has(p))) return
  let node = target
  path.forEach((part, i) => {
    const atual = Object.hasOwn(node, part) ? node[part] : undefined
    if (i === path.length - 1) {
      if (atual === undefined) node[part] = value
      else if (Array.isArray(atual)) atual.push(value)
      else node[part] = [atual, value]
      return
    }
    if (atual === undefined) node[part] = /^\d+$/.test(path[i + 1]) ? [] : {}
    // Listas também são indexadas por chave numérica em texto.
    node = node[part] as Campos
  })
}

/** Texto vindo do cliente: número vira texto; objeto, lista, booleano e nulo viram `undefined`. */
export function texto(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

/** Maior corpo aceito (foto de 5 MB + campos do formulário); lido antes de qualquer autenticação. */
export const CORPO_MAXIMO = 6 * 1024 * 1024

const corpoGrande = () => new HttpError(413, { message: 'Requisição maior que o permitido' })

/** Lê o corpo parando no limite, mesmo sem `content-length` (envio em partes). */
async function lerCorpo(req: NextRequest, maximo = CORPO_MAXIMO): Promise<Uint8Array<ArrayBuffer>> {
  if (!req.body) return new Uint8Array()
  const reader = req.body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maximo) {
      await reader.cancel()
      throw corpoGrande()
    }
    partes.push(value)
  }
  const corpo = new Uint8Array(total)
  let pos = 0
  for (const p of partes) {
    corpo.set(p, pos)
    pos += p.byteLength
  }
  return corpo
}

export class ApiRequest {
  private constructor(
    public raw: NextRequest,
    public body: Campos,
    private files: Map<string, File>
  ) {}

  /** `maximo`: limite do corpo nesta rota (o laudo em PDF aceita mais que o padrão). */
  static async from(req: NextRequest, { maximo = CORPO_MAXIMO }: { maximo?: number } = {}) {
    const method = req.method.toUpperCase()
    let body: Campos = {}
    const files = new Map<string, File>()

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const type = req.headers.get('content-type') || ''
      const declarado = Number(req.headers.get('content-length') || 0)
      if (declarado > maximo) throw corpoGrande()
      if (type.includes('multipart/form-data') || type.includes('application/x-www-form-urlencoded')) {
        const form = await new Response(await lerCorpo(req, maximo), { headers: { 'content-type': type } }).formData()
        for (const [key, value] of form.entries()) {
          if (typeof value === 'object' && value !== null && 'arrayBuffer' in value) {
            files.set(key, value as File)
          } else {
            setDeep(body, key, limpar(key, value))
          }
        }
      } else if (type.includes('json')) {
        const text = new TextDecoder().decode(await lerCorpo(req, maximo))
        body = text ? (convertEmptyStrings(JSON.parse(text)) as Campos) : {}
      }
    }
    return new ApiRequest(req, body ?? {}, files)
  }

  qs(): Campos {
    const out: Campos = {}
    // Query só perde as bordas: `?q=` continua '' (rotas usam o texto vazio como "sem filtro").
    for (const [key, value] of this.raw.nextUrl.searchParams.entries()) {
      setDeep(out, key, CAMPO_SENHA.test(key) ? value : value.trim())
    }
    return out
  }

  all(): Campos {
    return { ...this.qs(), ...this.body }
  }

  input<T = unknown>(key: string, defaultValue?: T): T {
    const all = this.all()
    const value = Object.hasOwn(all, key) ? all[key] : undefined
    return (value === undefined ? defaultValue : value) as T
  }

  /** Campo de texto (query ou corpo); qualquer outro tipo vira `undefined`. */
  text(key: string): string | undefined {
    const all = this.all()
    return Object.hasOwn(all, key) ? texto(all[key]) : undefined
  }

  only<K extends string>(keys: K[]): Record<K, unknown> {
    const all = this.all()
    return Object.fromEntries(keys.filter((k) => Object.hasOwn(all, k)).map((k) => [k, all[k]])) as Record<K, unknown>
  }

  file(name: string, options?: FileOptions): UploadedFile | null {
    const f = this.files.get(name)
    if (!f || f.size === 0) return null
    return new UploadedFile(name, f).validate(options)
  }

  header(name: string) {
    return this.raw.headers.get(name)
  }

  cookie(name: string) {
    return this.raw.cookies.get(name)?.value ?? null
  }
}
