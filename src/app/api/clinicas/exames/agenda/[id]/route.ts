import { requireClinica } from '@/server/auth/session'
import { ApiRequest, HttpError, ok, route } from '@/server/http'
import { cancelarPelaClinica, marcarRealizado } from '@/server/services/exames'

/** PATCH /clinicas/exames/agenda/:id { acao: 'realizado' | 'cancelar', motivo? } */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  const clinica = await requireClinica(request)
  const acao = request.text('acao')
  if (acao === 'realizado') return ok(await marcarRealizado(clinica.id, id))
  if (acao === 'cancelar') return ok(await cancelarPelaClinica(clinica.id, id, request.text('motivo')))
  throw new HttpError(400, { message: "Ação inválida: use 'realizado' ou 'cancelar'" })
})
