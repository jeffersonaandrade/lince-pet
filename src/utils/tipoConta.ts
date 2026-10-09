/** Rotas e rótulos por tipo de conta, usados no Header, no sino e no redirecionamento de onboarding. */
export function dashboardDoTipo(userType?: string | null) {
  switch (userType) {
    case "tutor":
      return "/dashboard/tutor";
    case "clinica":
      return "/dashboard/clinica";
    case "prestador":
      return "/dashboard/prestador";
    default:
      return "/dashboard/veterinario";
  }
}

export function onboardingDoTipo(userType?: string | null) {
  if (userType === "veterinario") return "/onboarding";
  if (userType === "prestador") return "/onboarding/prestador";
  return null;
}

export function rotuloDoTipo(userType?: string | null, tipoServicoNome?: string | null) {
  switch (userType) {
    case "tutor":
      return "Tutor";
    case "clinica":
      return "Clínica";
    case "prestador":
      return tipoServicoNome || "Profissional pet";
    default:
      return "Veterinário";
  }
}
