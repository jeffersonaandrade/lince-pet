import { Suspense } from "react";
import { AlterarPlano } from "@/components/Assinatura/AlterarPlano";

export default function AlterarPlanoPage() {
  return (
    <Suspense fallback={<div />}>
      <AlterarPlano
        tipo="veterinario"
        destaque="vet_starter"
        painel="/dashboard/veterinario"
        titulo="Escolha o plano ideal para você"
        descricao="Selecione o plano que melhor se adapta às suas necessidades e comece a transformar seus agendamentos."
      />
    </Suspense>
  );
}
