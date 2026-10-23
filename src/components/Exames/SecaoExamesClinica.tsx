"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { ExamesService, formatarDuracao, formatarPreco, type OfertaExames } from "@/services/exames/exames";

/** Seção "Exames" do perfil público da clínica; some quando ela não oferece exames visíveis. */
export function SecaoExamesClinica({ clinicaId, className }: { clinicaId: string; className?: string }) {
  const [oferta, setOferta] = useState<OfertaExames | null>(null);

  useEffect(() => {
    ExamesService.daClinica(clinicaId)
      .then(setOferta)
      .catch(() => setOferta(null));
  }, [clinicaId]);

  if (!oferta) return null;
  return (
    <section className={className} aria-label="Exames">
      <h2>Exames</h2>
      <p className="mb-3 text-sm text-slate-500">Agende direto pela Lince Pet. O pagamento é feito na clínica.</p>
      <ul className="flex flex-col gap-2">
        {oferta.combos.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-orange-50 px-3 py-2 text-sm">
            <span>
              <strong className="text-slate-800">{c.nome}</strong>
              <span className="block text-xs text-slate-500">{c.exames.map((e) => e.nome).join(" + ")}</span>
            </span>
            <span className="font-semibold text-slate-800">{formatarPreco(c.preco)}</span>
          </li>
        ))}
        {oferta.exames.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-1.5 text-sm">
            <span className="flex items-center gap-2 text-slate-700">
              <FlaskConical size={14} className="text-orange-500" />
              {e.nome}
              <span className="text-xs text-slate-400">({formatarDuracao(e.duracao_min)})</span>
            </span>
            <span className="font-semibold text-slate-800">{formatarPreco(e.preco)}</span>
          </li>
        ))}
      </ul>
      <Link
        href={`/exames/${clinicaId}`}
        className="mt-4 inline-block rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
      >
        Agendar exame
      </Link>
    </section>
  );
}
