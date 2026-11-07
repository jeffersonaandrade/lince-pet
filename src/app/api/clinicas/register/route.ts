import { ApiRequest, badRequest, created, json, route, serverError } from '@/server/http'
import { generateToken } from '@/server/auth/jwt'
import { setAuthCookie } from '@/server/auth/session'
import { registerClinica, type ClinicaRegistrationData } from '@/server/services/clinicas'
import { LIMITES, limitarTentativas } from '@/server/rate-limit'
import { perfilAtendimentoValido } from '@/lib/perfil-atendimento'
import { ehCelular, ehFixo, telefoneNacional } from '@/utils/formatters'

export const POST = route(async (req) => {
  limitarTentativas(req, LIMITES.cadastro)
  const data = (await ApiRequest.from(req)).only([
    'nomeFantasia',
    'razaoSocial',
    'cnpj',
    'telefone',
    'celular',
    'perfilAtendimento',
    'email',
    'senha',
    'cep',
    'rua',
    'numero',
    'bairro',
    'cidade',
    'estado',
  ])

  if (!data.email || !data.senha || !data.cnpj) {
    return badRequest({ message: 'Dados incompletos' })
  }
  if (data.perfilAtendimento !== undefined && !perfilAtendimentoValido(data.perfilAtendimento)) {
    return badRequest({ message: 'Selecione um tipo de estabelecimento válido.' })
  }
  if (data.perfilAtendimento && data.telefone != null) {
    if (typeof data.telefone !== 'string' || !ehFixo(telefoneNacional(data.telefone))) {
      return badRequest({ message: 'Informe um telefone fixo com DDD ou deixe o campo em branco.' })
    }
    data.telefone = telefoneNacional(data.telefone)
  }
  if (data.celular != null) {
    if (typeof data.celular !== 'string' || !ehCelular(telefoneNacional(data.celular))) {
      return badRequest({ message: 'Informe um celular com DDD ou deixe o campo em branco.' })
    }
    data.celular = telefoneNacional(data.celular)
  }

  try {
    const { user, clinica } = await registerClinica(data as ClinicaRegistrationData)

    const token = await generateToken({
      id: user.id,
      nome: user.nome,
      sobrenome: undefined as unknown as null,
      userType: 'clinica',
      entityId: clinica.id,
    })

    const res = created({ message: 'Clínica registrada com sucesso', user, token })
    setAuthCookie(res, token)
    return res
  } catch (error) {
    if ((error as { status?: number }).status === 422) {
      return json({ message: (error as Error).message }, 422)
    }
    return serverError({ message: 'Erro ao registrar clínica' })
  }
})
