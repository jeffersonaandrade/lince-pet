"use client";

import { useState } from "react";
import type { PlanoBackend } from "@/services/assinaturas/assinaturas";

export const precoMensal = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ResumoContratacao({ plano, testeDisponivel, aceito, onAceite, disabled }: {
  plano: Pick<PlanoBackend, "code" | "name" | "priceCents" | "trialDays">;
  testeDisponivel: boolean; aceito: boolean; onAceite: (aceito: boolean) => void; disabled?: boolean;
}) {
  const [abertoEm] = useState(() => Date.now());
  const dias = testeDisponivel ? plano.trialDays ?? 0 : 0;
  const primeiraData = new Date(abertoEm + dias * 86_400_000).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return (
    <section aria-label="Resumo da contratação" className="mt-4 flex flex-col gap-3 rounded-xl border border-orange-200 bg-orange-50 p-5 text-left text-slate-800">
      <h3 className="text-lg font-bold">Confira antes de confirmar</h3>
      <p><strong>{plano.name} — {plano.priceCents > 0 ? `${precoMensal(plano.priceCents)}/mês` : "Gratuito, sem mensalidade"}</strong></p>
      {plano.priceCents > 0 ? <>
        <p>{dias > 0 ? `${dias} dias grátis. Primeiro vencimento previsto: ${primeiraData}, no valor de ${precoMensal(plano.priceCents)}. Após o teste, o plano custa ${precoMensal(plano.priceCents)} por mês.` : `Sem novo período de teste. Primeira fatura de ${precoMensal(plano.priceCents)}, com vencimento previsto para ${primeiraData}. O plano muda após a confirmação do pagamento.`}</p>
        <p className="text-sm">Assinatura mensal. Você escolhe a forma de pagamento na fatura do Asaas, entre as opções habilitadas (Pix, boleto ou cartão). A data definitiva aparece na confirmação. Você pode solicitar o cancelamento pelo sistema.</p>
        <p className="text-sm">Ao escolher cartão de crédito na fatura, as próximas mensalidades podem ser cobradas automaticamente pelo Asaas.</p>
        <label className="flex items-start gap-2 text-sm font-medium">
          <input type="checkbox" checked={aceito} disabled={disabled} onChange={e => onAceite(e.target.checked)} className="mt-1" />
          Li e concordo com a assinatura do {plano.name} por {precoMensal(plano.priceCents)} por mês{dias > 0 ? ` após os ${dias} dias grátis` : ""}.
        </label>
      </> : <p className="text-sm">Inclui 5 agendamentos por mês. Não gera fatura nem cobrança.</p>}
    </section>
  );
}
