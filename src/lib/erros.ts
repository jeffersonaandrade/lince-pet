type RespostaDeErro = { response?: { status?: unknown; data?: { message?: unknown; error?: unknown } } };

const resposta = (error: unknown) =>
  error && typeof error === "object" ? (error as RespostaDeErro).response : undefined;

/** Status HTTP de um erro do axios (ou `undefined` se não veio da API). */
export function statusDoErro(error: unknown): number | undefined {
  const status = resposta(error)?.status;
  return typeof status === "number" ? status : undefined;
}

/** Mensagem que a API mandou no corpo do erro (`message` ou `error`), se houver. */
export function mensagemDaApi(error: unknown): string | undefined {
  const data = resposta(error)?.data;
  const msg = data?.message ?? data?.error;
  return typeof msg === "string" && msg.trim() ? msg : undefined;
}

const erroDoAxios = (error: unknown) =>
  Boolean(error && typeof error === "object" && (error as { isAxiosError?: unknown }).isAxiosError);

/**
 * Mensagem para mostrar ao usuário: a da API, a de um `Error` lançado pelo app ou o texto padrão.
 * A mensagem técnica do axios ("Request failed with status code 500") nunca aparece.
 */
export function mensagemDeErro(error: unknown, padrao: string): string {
  const daApi = mensagemDaApi(error);
  if (daApi) return daApi;
  if (erroDoAxios(error)) return padrao;
  return error instanceof Error && error.message ? error.message : padrao;
}
