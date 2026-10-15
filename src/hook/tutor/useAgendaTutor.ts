"use client";

import { useCallback, useMemo, useState } from "react";
import { AgendamentosService, type AgendamentoTutor } from "@/services/agendamentos/agendamentos";
import { agruparPorAno, classificarAgendamentos } from "@/lib/agenda-tutor";
import { mensagemDeErro } from "@/lib/erros";

/** Consultas do tutor: carrega, separa próximas/histórico e aplica as mudanças locais. */
export function useAgendaTutor() {
  const [agendamentos, setAgendamentos] = useState<AgendamentoTutor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await AgendamentosService.listarAgendamentos();
      setAgendamentos(res.agendamentos);
    } catch (error) {
      setErro(mensagemDeErro(error, "Erro ao carregar suas consultas."));
    } finally {
      setCarregando(false);
    }
  }, []);

  const cancelar = useCallback(async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta consulta?")) return;
    try {
      await AgendamentosService.cancelarAgendamento(id);
      setAgendamentos((lista) => lista.map((a) => (a.id === id ? { ...a, status: "cancelado", pode_cancelar: false } : a)));
    } catch (error) {
      alert(mensagemDeErro(error, "Erro ao cancelar agendamento"));
    }
  }, []);

  const marcarAvaliado = useCallback((id: string) => {
    setAgendamentos((lista) => lista.map((a) => (a.id === id ? { ...a, avaliado: true } : a)));
  }, []);

  const aplicarReagendamento = useCallback((id: string, dataIso: string, horario: string) => {
    const [ano, mes, dia] = dataIso.split("-");
    setAgendamentos((lista) =>
      lista.map((a) =>
        a.id === id ? { ...a, data_consulta: `${dia}/${mes}/${ano}`, horario_consulta: horario, status: "pendente" } : a
      )
    );
  }, []);

  const { proximas, historico } = useMemo(() => classificarAgendamentos(agendamentos), [agendamentos]);
  const historicoPorAno = useMemo(() => agruparPorAno(historico), [historico]);

  return { proximas, historicoPorAno, carregando, erro, carregar, cancelar, marcarAvaliado, aplicarReagendamento };
}
