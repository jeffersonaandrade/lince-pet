"use client";

import { Suspense } from "react";
import { AlterarPlano } from "@/components/Assinatura/AlterarPlano";
import { PLANOS_VETERINARIO } from "@/config/planos";

export default function AlterarPlanoPage() {
  return (
    <Suspense fallback={<div />}>
      <AlterarPlano
        tipo="veterinario"
        planos={PLANOS_VETERINARIO}
        destaque="vet_starter"
        painel="/dashboard/veterinario"
        titulo="Escolha o plano ideal para você"
        descricao="Selecione o plano que melhor se adapta às suas necessidades e comece a transformar seus agendamentos."
      />
    </Suspense>
  );
}
