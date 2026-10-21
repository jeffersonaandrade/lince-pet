"use client";

import { useState } from "react";
import { AgendamentosService } from "@/services/agendamentos/agendamentos";
import type { MotivoCancelamentoTutor } from "@/lib/motivos-cancelamento";
import { mensagemDeErro } from "@/lib/erros";

/** Modal de cancelamento pelo tutor: o motivo é escolhido de uma lista fixa e chega ao profissional. */
export function useCancelamentoConsulta(onCancelado: (id: string) => void) {
  const [agendamentoId, setAgendamentoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<MotivoCancelamentoTutor | "">("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const abrir = (id: string) => {
    setAgendamentoId(id);
    setMotivo("");
    setErro(null);
  };

  const fechar = () => setAgendamentoId(null);

  const confirmar = async () => {
    if (!agendamentoId) return;
    if (!motivo) {
      setErro("Escolha o motivo do cancelamento");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await AgendamentosService.cancelarAgendamento(agendamentoId, motivo);
      onCancelado(agendamentoId);
      setAgendamentoId(null);
    } catch (error) {
      setErro(mensagemDeErro(error, "Erro ao cancelar agendamento"));
    } finally {
      setEnviando(false);
    }
  };

  return { aberto: agendamentoId !== null, motivo, erro, enviando, setMotivo, abrir, fechar, confirmar };
}
