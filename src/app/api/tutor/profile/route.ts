import { prisma } from '@/server/db'
import { ApiRequest, HttpError, notFound, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { updating } from '@/server/lucid'
import { CAMPOS_ENDERECO_TUTOR, enderecoDoTutor } from '@/lib/endereco-tutor'

/** PUT /tutor/profile (os canais de aviso ficam em /me/notificacoes) */
export const PUT = route(async (req) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request, ['tutor'])
  try {
    const { nome, endereco, celular } = request.only(['nome', 'endereco', 'celular'])
    let enderecoValidado: Record<string, string> | undefined
    if (endereco !== undefined) {
      if (!endereco || typeof endereco !== 'object' || Array.isArray(endereco)) throw new HttpError(422, { message: 'Endereço inválido.' })
      const bruto = enderecoDoTutor(endereco)
      if (CAMPOS_ENDERECO_TUTOR.some(k => k !== 'bairro' && !bruto[k]?.trim())) throw new HttpError(422, { message: 'Preencha CEP, rua, número, cidade e estado.' })
      if (Object.values(bruto).some(v => v && v.length > 255) || !/^\d{5}-?\d{3}$/.test(bruto.cep!) || !/^[A-Z]{2}$/i.test(bruto.estado!)) throw new HttpError(422, { message: 'Confira o CEP e a sigla do estado.' })
      enderecoValidado = Object.fromEntries(CAMPOS_ENDERECO_TUTOR.map(k => [k, (bruto[k] ?? '').trim()]))
      enderecoValidado.cep = enderecoValidado.cep.replace(/\D/g, '')
      enderecoValidado.estado = enderecoValidado.estado.toUpperCase()
    }
    const telefone = typeof celular === 'string' ? celular.replace(/\D/g, '') : null
    if (celular !== undefined && (!telefone || telefone.length < 10 || telefone.length > 15)) throw new HttpError(422, { message: 'Celular inválido.' })

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    if (!dbUser) return notFound({ message: 'Usuário não encontrado' })

    if (nome && String(nome) !== dbUser.nome) {
      await prisma.user.update({ where: { id: dbUser.id }, data: updating({ nome: String(nome) }) })
    }

    if (enderecoValidado) await prisma.tutor.update({ where: { id: user.tutor!.id }, data: updating({ endereco: enderecoValidado }) })
    if (telefone) await prisma.user.update({ where: { id: user.id }, data: updating({ celular: telefone }) })
    return ok({ message: 'Perfil atualizado com sucesso' })
  } catch (error) {
    if (error instanceof HttpError) throw error
    console.error('❌ [Tutor] Erro ao atualizar perfil:', error)
    return serverError({ message: 'Erro ao atualizar perfil' })
  }
})
