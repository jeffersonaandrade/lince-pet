import { json, route } from '@/server/http'
import { fetchCep, isNotFoundOrTimeout } from '@/server/services/brazilapi'

export const GET = route<{ cep: string }>(async (_req, { cep }) => {
  try {
    return json(await fetchCep(cep))
  } catch (error) {
    if (isNotFoundOrTimeout(error)) return json({ error: 'O CEP digitado é inválido' }, 404)
    console.error(error)
    return json({ error: 'Ocorreu um erro inesperado' }, 500)
  }
})
