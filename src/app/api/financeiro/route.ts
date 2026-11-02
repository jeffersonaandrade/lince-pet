import { ApiRequest, created, ok, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import {
  criarFinanceiro,
  painelFinanceiro,
} from "@/server/services/financeiro";

export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), [
    "veterinario",
    "clinica",
  ]);
  return ok(await painelFinanceiro(user, req.nextUrl.searchParams));
});
export const POST = route(async (req) => {
  const r = await ApiRequest.from(req),
    user = await requireUser(r, ["veterinario", "clinica"]);
  return created(await criarFinanceiro(user, r.body));
});
