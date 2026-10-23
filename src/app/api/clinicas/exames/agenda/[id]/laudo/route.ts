import { requireClinica } from '@/server/auth/session'
import { ApiRequest, created, route } from '@/server/http'
import { enviarLaudo } from '@/server/services/laudos'

/** POST /clinicas/exames/agenda/:id/laudo (multipart, campo `laudo`): PDF de até 10 MB; reenviar substitui. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req, { maximo: 11 * 1024 * 1024 })
  const clinica = await requireClinica(request)
  const arquivo = request.file('laudo')
  const dados = arquivo ? { buffer: await arquivo.buffer(), nome: arquivo.clientName } : null
  return created(await enviarLaudo(clinica.id, clinica.userId, id, dados))
})
