"use client";

import { useEffect, useState } from "react";
import { AgendamentosService, type AgendamentoTutor } from "@/services/agendamentos/agendamentos";
import { getVeterinarioById } from "@/services/veterinarios/veterinarios";
import { gradeDoAgendamento, horariosParaReagendar, type AgendaVeterinario } from "@/lib/agenda-tutor";
import { dataParaIso } from "@/lib/horarios";
import { mensagemDeErro } from "@/lib/erros";

/** Modal de reagendamento de consulta com veterinário (pedido de prestador usa `RemarcarPedidoModal`). */
export function useReagendamento(onReagendado: (id: string, dataIso: string, horario: string) => void) {
  const [agendamento, setAgendamento] = useState<AgendamentoTutor | null>(null);
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [agenda, setAgenda] = useState<AgendaVeterinario | null>(null);
  const [horarios, setHorarios] = useState<string[]>([]);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);

  const vetId = agendamento?.veterinario?.id;

  useEffect(() => {
    setAgenda(null);
    if (!vetId) return;
    let ativo = true;
    getVeterinarioById(vetId)
      .then((res: { veterinario?: AgendaVeterinario }) => {
        if (ativo) setAgenda(res.veterinario ?? {});
      })
      .catch((error: unknown) => {
        if (ativo) setErro(mensagemDeErro(error, "Não foi possível carregar a agenda do veterinário."));
      });
    return () => {
      ativo = false;
    };
  }, [vetId]);

  useEffect(() => {
    setHorarios([]);
    if (!agenda || !data || !agendamento?.veterinario) return;
    let ativo = true;
    const grade = gradeDoAgendamento(agenda, agendamento);
    setCarregandoHorarios(true);
    AgendamentosService.verificarDisponibilidade(agendamento.veterinario.id, data)
      .then((disponibilidade) => {
        if (!ativo) return;
        const livres = horariosParaReagendar({ grade, agendamento, data, disponibilidade });
        setHorarios(livres);
        setHorario((atual) => (livres.includes(atual) ? atual : ""));
      })
      .catch((error: unknown) => {
        if (ativo) setErro(mensagemDeErro(error, "Não foi possível verificar os horários livres."));
      })
      .finally(() => {
        if (ativo) setCarregandoHorarios(false);
      });
    return () => {
      ativo = false;
    };
  }, [agenda, data, agendamento]);

  const abrir = (a: AgendamentoTutor) => {
    setAgendamento(a);
    setData(dataParaIso(a.data_consulta));
    setHorario(a.horario_consulta?.slice(0, 5) || "");
    setErro(null);
  };

  const fechar = () => setAgendamento(null);

  const confirmar = async () => {
    if (!agendamento) return;
    if (!data || !horario) {
      setErro("Selecione a data e o horário");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await AgendamentosService.reagendarAgendamento(agendamento.id, data, horario);
      onReagendado(agendamento.id, data, horario);
      setAgendamento(null);
    } catch (error) {
      setErro(mensagemDeErro(error, "Falha ao reagendar consulta"));
    } finally {
      setEnviando(false);
    }
  };

  return {
    aberto: agendamento !== null,
    data,
    horario,
    horarios,
    carregandoHorarios,
    erro,
    enviando,
    setData,
    setHorario,
    abrir,
    fechar,
    confirmar,
  };
}
