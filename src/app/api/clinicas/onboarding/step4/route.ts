import { ApiRequest, badRequest, ok, route, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { confirmarUpload, fotoDoCliente, uploadClinicaPhoto, type UploadResult } from '@/server/services/storage'
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
  const userChanges: Record<string, string> = {}
  const fotoAnterior = clinica.fotoPerfil
  const profilePicAnterior = currentUser.profilePic

  const uploadedFile = request.file('fotoPerfil', {
    size: '5mb',
    extnames: ['jpg', 'jpeg', 'png', 'webp'],
  })

  let upload: UploadResult | null = null
  if (uploadedFile) {
    if (!uploadedFile.isValid) return badRequest({ message: 'Arquivo inválido', errors: uploadedFile.errors })
    upload = await uploadClinicaPhoto(clinica.id, {
      buffer: await uploadedFile.buffer(),
      originalname: uploadedFile.clientName || 'clinica.jpg',
      mimetype: uploadedFile.type || 'image/jpeg',
    })
    clinicaChanges.fotoPerfil = upload.url
    userChanges.profilePic = upload.url
  } else {
    const fotoUrl = fotoDoCliente(str(request.only(['fotoUrl']).fotoUrl))
    if (fotoUrl) {
      clinicaChanges.fotoPerfil = fotoUrl
      userChanges.profilePic = fotoUrl
    }
  }

  if (nome) clinicaChanges.nomeClinica = nome
  if (descricao) clinicaChanges.descricao = descricao
  if (cep) clinicaChanges.cep = cep
  if (cidade) clinicaChanges.cidade = cidade
  if (estado) clinicaChanges.estado = estado
  if (rua && numero && bairro) clinicaChanges.endereco = `${rua}, ${numero} - ${bairro}`
  if (telefone) clinicaChanges.telefone = telefone

  if (nome) userChanges.nome = nome
  if (cep) userChanges.cep = cep
  if (rua) userChanges.rua = rua
  if (numero) userChanges.numero = numero
  if (bairro) userChanges.bairro = bairro
  if (cidade) userChanges.cidade = cidade
  if (estado) userChanges.estado = estado
  if (telefone) userChanges.celular = telefone

  const gravar = async () => {
    await saveClinica(clinica, clinicaChanges)
    await saveUser(currentUser, userChanges)
  }
  if (upload) {
    await confirmarUpload(upload, gravar, {
      anteriores: [fotoAnterior, profilePicAnterior],
      emUso: [clinica.fotoCapa],
    })
  } else {
    await gravar()
  }

  return ok({
    message: 'Perfil salvo com sucesso',
    fotoUrl: clinica.fotoPerfil,
  })
})
