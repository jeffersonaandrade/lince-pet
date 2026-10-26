import { enderecoDoTutor } from '@/lib/endereco-tutor'

/** Consulta do veterinário ou pedido no domicílio do tutor. */
export function ehDomicilioDoTutor(a: { tipoConsulta?: string | null; localNome?: string | null }) {
  return a.tipoConsulta === 'domicilio' || a.localNome === 'Domicílio do tutor'
}

const ENDERECO_LIBERADO = new Set([
  'confirmado',
  'confirmada',
  'em andamento',
  'realizado',
  'finalizado',
  'concluido',
  'concluida',
])

/** Aceite, atendimento em curso ou concluído. Pendente e cancelado continuam restritos. */
export function enderecoLiberado(status: string | null | undefined) {
  return ENDERECO_LIBERADO.has((status || '').toLowerCase())
}

export function bairroRegistrado(localBairro: string | null | undefined, enderecoTutor: unknown) {
  return localBairro?.trim() || enderecoDoTutor(enderecoTutor).bairro?.trim() || null
}

export function textoDoBairro(bairro: string | null | undefined) {
  return bairro?.trim() ? `Bairro ${bairro.trim()}` : 'Bairro não informado'
}

type Visita = {
  tipoConsulta?: string | null
  localNome?: string | null
  localEndereco?: string | null
  localBairro?: string | null
  status?: string | null
  enderecoTutor?: unknown
}

/** Rua e número só depois do aceite. Fora do domicílio, o endereço profissional segue visível. */
export function enderecoVisivelAoProfissional(a: Visita) {
  if (!ehDomicilioDoTutor(a) || enderecoLiberado(a.status)) return a.localEndereco ?? null
  return textoDoBairro(bairroRegistrado(a.localBairro, a.enderecoTutor))
}

/** Linha de local dos avisos. O tutor vê o próprio endereço; o profissional, a versão já filtrada. */
export function textoLocal(a: Visita, visao: 'tutor' | 'profissional') {
  if (!ehDomicilioDoTutor(a)) return a.localNome || a.localEndereco || a.tipoConsulta || 'a combinar'
  const endereco = visao === 'profissional' ? enderecoVisivelAoProfissional(a) : a.localEndereco
  return [a.localNome || 'Domicílio do tutor', endereco].filter(Boolean).join(' — ')
}
