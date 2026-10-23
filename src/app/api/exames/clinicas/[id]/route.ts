import { ApiRequest, ok, route } from '@/server/http'
import { examesDaClinicaPublica } from '@/server/services/exames'

/** GET /exames/clinicas/:id: exames e combos da clínica (null se ela não oferece exames visíveis). */
export const GET = route<{ id: string }>(async (req, { id }) => {
  await ApiRequest.from(req)
  return ok({ oferta: await examesDaClinicaPublica(id) })
})
