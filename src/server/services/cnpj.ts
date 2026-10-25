import { HttpError } from '../http'

export function normalizarCnpj(valor: unknown) {
  const texto = typeof valor === 'string' ? valor.trim() : ''
  const numero = texto.replace(/[.\/\-\s]/g, '')
  if (!/^\d{14}$/.test(numero)) throw new HttpError(422, { message: 'Informe um CNPJ com 14 dígitos.' })
  return numero
}
