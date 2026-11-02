import { ApiRequest, ok, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import {
  alterarFinanceiro,
  detalheFinanceiro,
} from "@/server/services/financeiro";

export const GET = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), [
    "veterinario",
    "clinica",
  ]);
  return ok(await detalheFinanceiro(user, id));
});
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const r = await ApiRequest.from(req),
    user = await requireUser(r, ["veterinario", "clinica"]);
  return ok(await alterarFinanceiro(user, id, r.body));
});
