"use client";

import { useState } from "react";
import { AvaliacoesService } from "@/services/avaliacoes/avaliacoes";
import type { AgendamentoTutor } from "@/services/agendamentos/agendamentos";
import { mensagemDeErro } from "@/lib/erros";

type Nota = { estrelas: number; comentario: string };
const NOTA_VAZIA: Nota = { estrelas: 0, comentario: "" };

/** Avaliação do profissional e, quando a consulta foi numa clínica, também da clínica. */
export function useAvaliacaoConsulta(onAvaliado: (agendamentoId: string) => void) {
  const [agendamento, setAgendamento] = useState<AgendamentoTutor | null>(null);
  const [profissional, setProfissional] = useState<Nota>(NOTA_VAZIA);
  const [clinica, setClinica] = useState<Nota>(NOTA_VAZIA);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const avaliaClinica = Boolean(agendamento?.clinica_id);

  const abrir = (a: AgendamentoTutor) => {
    setAgendamento(a);
    setProfissional(NOTA_VAZIA);
    setClinica(NOTA_VAZIA);
    setErro(null);
  };

  const fechar = () => setAgendamento(null);

  const enviar = async () => {
    if (!agendamento) return;
    if (profissional.estrelas < 1) {
      setErro("Selecione de 1 a 5 estrelas para o profissional");
      return;
    }
    if (avaliaClinica && clinica.estrelas < 1) {
      setErro("Selecione de 1 a 5 estrelas para a clínica");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await AvaliacoesService.criarAvaliacao(agendamento.id, {
        estrelas: profissional.estrelas,
        comentario: profissional.comentario.trim() || undefined,
        estrelasClinica: avaliaClinica ? clinica.estrelas : undefined,
        comentarioClinica: avaliaClinica ? clinica.comentario.trim() || undefined : undefined,
      });
      onAvaliado(agendamento.id);
      setAgendamento(null);
    } catch (error) {
      setErro(mensagemDeErro(error, "Falha ao enviar avaliação"));
    } finally {
      setEnviando(false);
    }
  };

  return {
    agendamento,
    avaliaClinica,
    profissional,
    clinica,
    erro,
    enviando,
    setProfissional,
    setClinica,
    abrir,
    fechar,
    enviar,
  };
}
