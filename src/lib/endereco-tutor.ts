export const CAMPOS_ENDERECO_TUTOR = ['cep', 'rua', 'numero', 'bairro', 'cidade', 'estado'] as const
export function enderecoDoTutor(valor: unknown) {
  const origem = valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : {}
  return Object.fromEntries(CAMPOS_ENDERECO_TUTOR.map(k => [k, typeof origem[k] === 'string' ? origem[k] as string : null])) as Record<typeof CAMPOS_ENDERECO_TUTOR[number], string | null>
}
