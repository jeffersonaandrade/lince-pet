import type { AgendamentoTutor, DisponibilidadeResponse } from "@/services/agendamentos/agendamentos";
import { dataParaIso, diaDaSemana, normalizarGrade, type GradeSemanal } from "./horarios";

/** Âncora das "Próximas Consultas" no painel do tutor; os e-mails de consulta apontam para ela. */
export const ANCORA_CONSULTAS = "consultas";
export const URL_CONSULTAS_TUTOR = `https://www.lincepet.com.br/dashboard/tutor#${ANCORA_CONSULTAS}`;

const STATUS_PROXIMAS = new Set(["pendente", "confirmado", "em andamento"]);
const STATUS_CONCLUIDA = new Set(["realizado", "concluido", "concluida"]);

const chaveStatus = (status?: string | null) => (status || "").trim().toLowerCase();

/** Próximas: pendente, confirmado e em andamento. Todo o resto vai para o histórico, para nenhuma consulta sumir. */
export function classificarAgendamentos<T extends Pick<AgendamentoTutor, "status">>(lista: T[]) {
  const proximas: T[] = [];
  const historico: T[] = [];
  for (const agendamento of lista) {
    (STATUS_PROXIMAS.has(chaveStatus(agendamento.status)) ? proximas : historico).push(agendamento);
  }
  return { proximas, historico };
}

export const consultaConcluida = (status?: string | null) => STATUS_CONCLUIDA.has(chaveStatus(status));

const ROTULOS: Record<string, string> = {
  realizado: "Concluída",
  concluido: "Concluída",
  concluida: "Concluída",
  "em andamento": "Em andamento",
  pendente: "Aguardando",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  reagendado: "Reagendado",
  recusado: "Recusado",
};

export function rotuloStatus(status?: string | null): string {
  return ROTULOS[chaveStatus(status)] ?? (status || "");
}

/** Classe CSS do badge: `status-em-andamento`, `status-pendente`... */
export const classeStatus = (status?: string | null) => `status-${chaveStatus(status).replace(/\s+/g, "-")}`;

/** Agrupa o histórico por ano da consulta, do mais recente ao mais antigo; data inválida vai para "Anteriores". */
export function agruparPorAno<T extends Pick<AgendamentoTutor, "data_consulta">>(lista: T[]) {
  const grupos = new Map<string, T[]>();
  for (const agendamento of lista) {
    const ano = /^\d{4}/.exec(dataParaIso(agendamento.data_consulta))?.[0] ?? "Anteriores";
    grupos.set(ano, [...(grupos.get(ano) ?? []), agendamento]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => (a === "Anteriores" ? 1 : b === "Anteriores" ? -1 : Number(b) - Number(a)))
    .map(([ano, itens]) => ({ ano, itens }));
}

/** Configurações de agenda do vet como `GET /veterinarios/:id` devolve. */
export type AgendaVeterinario = {
  availability?: unknown;
  horariosOnline?: unknown;
  locations?: { id: string; clinicaId?: string | null; availability?: unknown }[];
};

type AgendamentoReagendavel = Pick<AgendamentoTutor, "tipo_consulta" | "clinica_id" | "data_consulta" | "horario_consulta">;

/** Grade do local da consulta: online usa a grade online; clínica usa a do local; sem grade própria, a do vet. */
export function gradeDoAgendamento(agenda: AgendaVeterinario, agendamento: AgendamentoReagendavel): GradeSemanal {
  const padrao = normalizarGrade(agenda.availability);
  if (agendamento.tipo_consulta === "online") {
    const online = normalizarGrade(agenda.horariosOnline);
    return Object.keys(online).length ? online : padrao;
  }
  const clinicaId = agendamento.clinica_id;
  const local = clinicaId
    ? agenda.locations?.find((l) => l.clinicaId === clinicaId || l.id === clinicaId)
    : undefined;
  const doLocal = normalizarGrade(local?.availability);
  return Object.keys(doLocal).length ? doLocal : padrao;
}

/**
 * Horários livres para reagendar em `data` (`YYYY-MM-DD`).
 * Sai o que está ocupado ou bloqueado; o horário atual da própria consulta continua disponível na mesma data
 * (ele aparece como ocupado por ela mesma). Hoje, horários que já passaram não aparecem.
 */
export function horariosParaReagendar({
  grade,
  agendamento,
  data,
  disponibilidade,
  agora = new Date(),
}: {
  grade: GradeSemanal;
  agendamento: AgendamentoReagendavel;
  data: string;
  disponibilidade: DisponibilidadeResponse;
  agora?: Date;
}): string[] {
  const dia = diaDaSemana(data);
  if (!dia || disponibilidade.dia_bloqueado) return [];

  const hhmm = (h: string) => h.slice(0, 5);
  const ocupados = new Set((disponibilidade.horarios_ocupados ?? []).map(hhmm));
  const bloqueados = new Set((disponibilidade.horarios_bloqueados ?? []).map(hhmm));
  const mesmaData = dataParaIso(agendamento.data_consulta) === data;
  const horarioAtual = agendamento.horario_consulta?.slice(0, 5);

  const hojeIso = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
  const agoraHHmm = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;

  const livres = (grade[dia] ?? []).filter((slot) => {
    if (bloqueados.has(slot)) return false;
    if (data === hojeIso && slot <= agoraHHmm) return false;
    return !ocupados.has(slot) || (mesmaData && slot === horarioAtual);
  });
  return [...new Set(livres)].sort((a, b) => a.localeCompare(b));
}
