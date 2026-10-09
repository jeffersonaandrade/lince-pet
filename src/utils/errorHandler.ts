interface ApiError {
  response?: {
    status?: number;
    data?: {
      message?: string;
      errors?: Array<{ message: string; field: string; rule: string }>;
    };
  };
  message?: string;
}

export interface ErrorState {
  message: string;
  fieldErrors?: Record<string, string>;
}

export const handleApiError = (
  error: unknown,
  customErrorMessages?: Record<number, string>
): ErrorState => {
  const defaultMessage = "Ocorreu um erro inesperado. Tente novamente.";

  const defaultStatusMessages: Record<number, string> = {
    400: "Dados inválidos. Verifique as informações e tente novamente.",
    401: "Acesso negado. Faça login novamente.",
    403: "Você não tem permissão para realizar esta ação.",
    404: "Informação não encontrada.",
    409: "Conflito nos dados. Verifique se as informações já existem.",
    422: "Dados inválidos. Verifique os campos e tente novamente.",
    429: "Muitas tentativas. Aguarde um momento e tente novamente.",
    500: "Ocorreu um erro inesperado. Tente novamente em alguns minutos.",
    502: "Serviço temporariamente indisponível.",
    503: "Serviço em manutenção. Tente novamente mais tarde.",
  };

  const apiError = error as ApiError;

  if (!apiError.response) {
    return { message: defaultMessage };
  }

  const { status, data } = apiError.response;

  if (customErrorMessages && status && customErrorMessages[status]) {
    return { message: customErrorMessages[status] };
  }

  // Handle AdonisJS/VineJS validation errors
  if (data?.errors && Array.isArray(data.errors)) {
    const fieldErrors: Record<string, string> = {};
    data.errors.forEach((err) => {
      if (err.field && err.message) {
        fieldErrors[err.field] = err.message;
      }
    });
    return {
      message: "Por favor, verifique os campos destacados abaixo.",
      fieldErrors,
    };
  }

  // Handle explicit backend messages (like "Email já está em uso")
  if (data?.message) {
    return { message: data.message };
  }

  if (status && defaultStatusMessages[status]) {
    return { message: defaultStatusMessages[status] };
  }

  return { message: defaultMessage };
};
