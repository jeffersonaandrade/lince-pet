import { ApiRequest, json, route, serverError } from '@/server/http'
import { searchVeterinarios } from '@/server/services/veterinarios'

export const GET = route(async (req) => {
  try {
    const { search, cidade, estado, especialidade, plano } = (await ApiRequest.from(req)).qs()
    const veterinarios = await searchVeterinarios({ search, cidade, estado, especialidade, plano })
    return json({ veterinarios })
  } catch (error) {
    console.error('❌ [VeterinariosController] Erro em searchPublic:', error)
    return serverError({ message: 'Erro interno do servidor', error: (error as Error).message })
  }
})
