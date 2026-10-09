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
    super(typeof body === 'object' && body && 'message' in body ? String((body as any).message) : `HTTP ${status}`)
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
    const messages = (error as any).messages as Array<{ message: string }>
    if (messages?.length) return json({ status: 422, message: messages[0].message }, 422)
  }

  if (error && typeof error === 'object') {
    const err = error as any
    if (err.code === 'E_VALIDATION_ERROR' && err.messages?.length > 0) {
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

const emptyToNull = (v: unknown) => (v === '' ? null : v)

function convertEmptyStrings(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(convertEmptyStrings)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convertEmptyStrings(v)]))
  }
  return emptyToNull(value)
}

/** Monta objeto a partir de chaves estilo `campo[0][sub]` (como o bodyparser do Adonis). */
function setDeep(target: Record<string, any>, key: string, value: unknown) {
  const path = key.replace(/\]/g, '').split('[').filter((p) => p !== '')
  let node: any = target
  path.forEach((part, i) => {
    const last = i === path.length - 1
    if (last) {
      if (node[part] === undefined) node[part] = value
      else if (Array.isArray(node[part])) node[part].push(value)
      else node[part] = [node[part], value]
      return
    }
    if (node[part] === undefined) node[part] = /^\d+$/.test(path[i + 1]) ? [] : {}
    node = node[part]
  })
}

export class ApiRequest {
  private constructor(
    public raw: NextRequest,
    public body: Record<string, any>,
    private files: Map<string, File>
  ) {}

  static async from(req: NextRequest) {
    const method = req.method.toUpperCase()
    let body: Record<string, any> = {}
    const files = new Map<string, File>()

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const type = req.headers.get('content-type') || ''
      if (type.includes('multipart/form-data') || type.includes('application/x-www-form-urlencoded')) {
        const form = await req.formData()
        for (const [key, value] of form.entries()) {
          if (typeof value === 'object' && value !== null && 'arrayBuffer' in value) {
            files.set(key, value as File)
          } else {
            setDeep(body, key, emptyToNull(value))
          }
        }
      } else if (type.includes('json')) {
        const text = await req.text()
        body = text ? (convertEmptyStrings(JSON.parse(text)) as Record<string, any>) : {}
      }
    }
    return new ApiRequest(req, body ?? {}, files)
  }

  qs(): Record<string, any> {
    const out: Record<string, any> = {}
    for (const [key, value] of this.raw.nextUrl.searchParams.entries()) setDeep(out, key, value)
    return out
  }

  all(): Record<string, any> {
    return { ...this.qs(), ...this.body }
  }

  input<T = any>(key: string, defaultValue?: T): T {
    const value = this.all()[key]
    return (value === undefined ? defaultValue : value) as T
  }

  only<K extends string>(keys: K[]): Record<K, any> {
    const all = this.all()
    return Object.fromEntries(keys.filter((k) => k in all).map((k) => [k, all[k]])) as Record<K, any>
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
