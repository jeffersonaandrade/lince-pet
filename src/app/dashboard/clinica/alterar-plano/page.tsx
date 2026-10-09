"use client";

import { Suspense } from "react";
import { AlterarPlano } from "@/components/Assinatura/AlterarPlano";
import { PLANOS_CLINICA } from "@/config/planos";

export default function AlterarPlanoPage() {
  return (
    <Suspense fallback={<div />}>
      <AlterarPlano
        tipo="clinica"
        planos={PLANOS_CLINICA}
        destaque="clinic"
        painel="/dashboard/clinica"
        titulo="Escolha o plano ideal para a sua clínica"
        descricao="Selecione o plano pelo tamanho da sua equipe. Pequena até 5 veterinários, Média até 15 e Grande sem limite."
      />
    </Suspense>
  );
}
