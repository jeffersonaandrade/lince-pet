import { ApiRequest, badRequest, created, json, route, serverError } from '@/server/http'
import { generateToken } from '@/server/auth/jwt'
import { setAuthCookie } from '@/server/auth/session'
import { registerClinica, type ClinicaRegistrationData } from '@/server/services/clinicas'

export const POST = route(async (req) => {
  const data = (await ApiRequest.from(req)).only([
    'nomeFantasia',
    'razaoSocial',
    'cnpj',
    'telefone',
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
