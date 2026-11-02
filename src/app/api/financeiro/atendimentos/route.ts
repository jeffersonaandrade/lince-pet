import { ApiRequest, ok, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { atendimentosFinanceiro } from "@/server/services/financeiro";
export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), [
    "veterinario",
    "clinica",
  ]);
  return ok(await atendimentosFinanceiro(user, req.nextUrl.searchParams));
});
