import { ApiRequest, ok, route } from '@/server/http'
import { disponibilidadeExames } from '@/server/services/exames'

/** GET /exames/clinicas/:id/disponibilidade?data=YYYY-MM-DD&exame_ids=a,b ou &combo_id= */
export const GET = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  const exameIds = (request.text('exame_ids') || '').split(',').map((s) => s.trim()).filter(Boolean)
  return ok(
    await disponibilidadeExames(id, { exame_ids: exameIds, combo_id: request.text('combo_id') || null }, request.text('data') || '')
  )
})
