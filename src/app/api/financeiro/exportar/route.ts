import { ApiRequest, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { exportarFinanceiro } from "@/server/services/financeiro";
export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), [
    "veterinario",
    "clinica",
  ]);
  return new Response(
    await exportarFinanceiro(user, req.nextUrl.searchParams),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="controle-financeiro.csv"',
        "Cache-Control": "private, no-store",
      },
    },
  );
});
