import 'server-only'
import type { NextRequest } from 'next/server'
import { HttpError } from '../http'

/** Login/logout por formulário de outra origem não podem alterar a sessão. */
export function exigirMesmaOrigem(req: NextRequest) {
  const origin = req.headers.get('origin')
  const configured = process.env.NEXT_PUBLIC_APP_URL
  const expected = new URL(configured || req.url).origin
  if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== expected)) {
    throw new HttpError(403, { message: 'Origem da requisição não permitida' })
  }
  // Clientes de API sem cookies podem não enviar Origin. Formulários de navegador enviam.
  if (origin === 'null') throw new HttpError(403, { message: 'Origem da requisição não permitida' })
}
