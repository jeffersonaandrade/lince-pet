import { ApiRequest, json, route, serverError } from '@/server/http'
import { searchVeterinarios } from '@/server/services/veterinarios'

export const GET = route(async (req) => {
  try {
    const request = await ApiRequest.from(req)
    const [search, cidade, estado, especialidade, plano] = ['search', 'cidade', 'estado', 'especialidade', 'plano'].map(
      (campo) => request.text(campo)
    )
    const veterinarios = await searchVeterinarios({ search, cidade, estado, especialidade, plano })
    return json({ veterinarios })
  } catch (error) {
    console.error('❌ [VeterinariosController] Erro em searchPublic:', error)
    return serverError({ message: 'Erro interno do servidor' })
  }
})
