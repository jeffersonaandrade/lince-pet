import { ApiRequest, badRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { prisma } from '@/server/db'
import { updating } from '@/server/lucid'
import { uploadPrestadorPhoto } from '@/server/services/storage'
import { prestadorDoUsuario, salvarPasso3 } from '@/server/services/prestadores'

const OPTIONS = { size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }

/**
 * POST /prestadores/onboarding/passo3: apresentação, horários e foto (opcional) e conclui o onboarding.
 * Aceita JSON ou multipart (campo `foto`; `horarios` como JSON string).
 */
export const POST = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['prestador'])
  const prestador = await prestadorDoUsuario(user.id)

  const body = apiReq.all() as Record<string, unknown>
  if (typeof body.horarios === 'string') {
    try {
      body.horarios = JSON.parse(body.horarios)
    } catch {
      return badRequest({ message: 'Horários inválidos' })
    }
  }

  let fotoUrl: string | null = null
  const foto = apiReq.file('foto', OPTIONS)
  if (foto) {
    if (!foto.isValid) return badRequest({ message: 'Foto inválida', errors: foto.errors })
    const result = await uploadPrestadorPhoto({
      buffer: await foto.buffer(),
      originalname: foto.clientName || 'foto.jpg',
      mimetype: foto.type || 'image/jpeg',
    })
    fotoUrl = result.url
    await prisma.user.update({ where: { id: user.id }, data: updating({ profilePic: result.url }) })
  }

  await salvarPasso3(prestador, body, fotoUrl)
  return ok({ message: 'Perfil concluído', foto_url: fotoUrl })
})
