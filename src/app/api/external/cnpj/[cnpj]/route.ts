import { json, route } from '@/server/http'
import { fetchCnpj, isNotFoundOrTimeout } from '@/server/services/brazilapi'

export const GET = route<{ cnpj: string }>(async (_req, { cnpj }) => {
  try {
    return json(await fetchCnpj(cnpj))
  } catch (error) {
    if (isNotFoundOrTimeout(error)) return json({ error: 'O CNPJ digitado é inválido' }, 404)
    console.error(error)
    return json({ error: 'Ocorreu um erro inesperado' }, 500)
  }
})
