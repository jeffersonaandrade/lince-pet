import { ApiRequest, badRequest, ok, route, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { uploadClinicaPhoto } from '@/server/services/storage'
import { saveClinica, saveUser, str } from '@/server/services/clinicas'

export const POST = route(async (req) => {
  const request = await ApiRequest.from(req)
  const currentUser = await requireUser(request)
  const clinica = currentUser.clinica
  if (!clinica) {
    return unauthorized({ message: 'Acesso negado' })
  }

  const fields = request.only(['nome', 'descricao', 'cep', 'rua', 'numero', 'bairro', 'cidade', 'estado', 'telefone'])
  const { nome, descricao, cep, rua, numero, bairro, cidade, estado, telefone } = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, str(v)])
  ) as Record<keyof typeof fields, string | null | undefined>

  const clinicaChanges: Record<string, string> = {}

  const uploadedFile = request.file('fotoPerfil', {
    size: '5mb',
    extnames: ['jpg', 'jpeg', 'png', 'webp'],
  })

  if (uploadedFile) {
    if (!uploadedFile.isValid) return badRequest({ message: 'Arquivo inválido', errors: uploadedFile.errors })
    const result = await uploadClinicaPhoto({
      buffer: await uploadedFile.buffer(),
      originalname: uploadedFile.clientName || 'clinica.jpg',
      mimetype: uploadedFile.type || 'image/jpeg',
    })
    clinicaChanges.fotoPerfil = result.url
    await saveUser(currentUser, { profilePic: result.url })
  } else {
    const fotoUrl = str(request.only(['fotoUrl']).fotoUrl)
    if (fotoUrl) {
      clinicaChanges.fotoPerfil = fotoUrl
      await saveUser(currentUser, { profilePic: fotoUrl })
    }
  }

  if (nome) clinicaChanges.nomeClinica = nome
  if (descricao) clinicaChanges.descricao = descricao
  if (cep) clinicaChanges.cep = cep
  if (cidade) clinicaChanges.cidade = cidade
  if (estado) clinicaChanges.estado = estado
  if (rua && numero && bairro) clinicaChanges.endereco = `${rua}, ${numero} - ${bairro}`
  if (telefone) clinicaChanges.telefone = telefone

  await saveClinica(clinica, clinicaChanges)

  const userChanges: Record<string, string> = {}
  if (nome) userChanges.nome = nome
  if (cep) userChanges.cep = cep
  if (rua) userChanges.rua = rua
  if (numero) userChanges.numero = numero
  if (bairro) userChanges.bairro = bairro
  if (cidade) userChanges.cidade = cidade
  if (estado) userChanges.estado = estado
  if (telefone) userChanges.celular = telefone

  await saveUser(currentUser, userChanges)

  return ok({
    message: 'Perfil salvo com sucesso',
    fotoUrl: clinica.fotoPerfil,
  })
})
