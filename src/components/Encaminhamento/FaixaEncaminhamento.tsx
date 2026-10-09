"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send } from "lucide-react";
import { EncaminhamentosService, type Encaminhamento } from "@/services/encaminhamentos/encaminhamentos";

/** Lê `?encaminhamento=&pet=` da tela de agendamento e carrega o encaminhamento do tutor. */
export function useEncaminhamentoDaUrl() {
  const params = useSearchParams();
  const id = params.get("encaminhamento");
  const petId = params.get("pet");
  const [encaminhamento, setEncaminhamento] = useState<Encaminhamento | null>(null);

  useEffect(() => {
    if (!id) return;
    let ativo = true;
    EncaminhamentosService.obter(id)
      .then((e) => ativo && setEncaminhamento(e))
      .catch(() => ativo && setEncaminhamento(null));
    return () => {
      ativo = false;
    };
  }, [id]);

  return { encaminhamentoId: id, petId: petId ?? encaminhamento?.pet?.id ?? null, encaminhamento };
}

export function FaixaEncaminhamento({ encaminhamento }: { encaminhamento: Encaminhamento | null }) {
  if (!encaminhamento) return null;
  return (
    <div className="flex gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
      <Send size={18} className="mt-0.5 shrink-0 text-orange-500" />
      <div>
        <p className="font-semibold">
          Encaminhado por {encaminhamento.origem.nome}
          {encaminhamento.pet ? ` para ${encaminhamento.pet.nome}` : ""}
        </p>
        <p className="whitespace-pre-wrap text-xs">{encaminhamento.motivo}</p>
      </div>
    </div>
  );
}
