"use client";

import { useState } from "react";
import { AlertCircle, Clock, CreditCard, Dog, MapPin, Maximize2, PawPrint } from "lucide-react";
import styles from "../tutor.module.css";
import { RemarcarPedidoModal } from "@/components/Prestador/RemarcarPedidoModal";
import { classeStatus, rotuloStatus } from "@/lib/agenda-tutor";
import type { AgendamentoTutor } from "@/services/agendamentos/agendamentos";

export function StatusBadge({ status }: { status?: string | null }) {
  const variante = (styles as Record<string, string>)[classeStatus(status)];
  return (
    <span className={[styles.statusBadge, variante].filter(Boolean).join(" ")}>
      <span className={styles.statusIndicator} />
      {rotuloStatus(status)}
    </span>
  );
}

const formatarPreco = (preco: AgendamentoTutor["preco_consulta"]) => {
  const valor = Number(preco);
  return preco !== null && preco !== "" && Number.isFinite(valor) && valor > 0
    ? `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : "Não informado";
};

const botaoAcao = "rounded-lg border bg-white px-4 py-2 text-sm font-medium cursor-pointer transition";

type Props = {
  agendamento: AgendamentoTutor;
  onCancel: (id: string) => void;
  onReschedule: (agendamento: AgendamentoTutor) => void;
  onChanged: () => void;
  onRate?: (agendamento: AgendamentoTutor) => void;
  podeAvaliar?: boolean;
};

export function AppointmentItem({ agendamento, onCancel, onReschedule, onChanged, onRate, podeAvaliar = false }: Props) {
  const [remarcando, setRemarcando] = useState(false);
  const { prestador, pet } = agendamento;
  const profissional = prestador
    ? `${prestador.nome} ${prestador.sobrenome ?? ""}`.trim()
    : `Dr(a). ${`${agendamento.veterinario?.nome ?? ""} ${agendamento.veterinario?.sobrenome ?? ""}`.trim()}`;
  const hora = agendamento.horario_consulta?.slice(0, 5) || "--:--";
  const podeRemarcar = prestador ? Boolean(prestador.servico_id) : Boolean(agendamento.veterinario);

  return (
    <div className={styles.appointmentItem}>
      <div className={styles.appointmentDetailSection}>
        <div className={styles.appointmentMainInfo}>
          <div>
            <div className={styles.appointmentLocationName}>
              <MapPin size={18} className={styles.metaIcon} />
              {agendamento.local_nome || "Local não informado"}
            </div>
            {agendamento.local_endereco ? (
              <div className={styles.appointmentLocationAddress}>{agendamento.local_endereco}</div>
            ) : null}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-500">{profissional}</span>
              {prestador ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                  <PawPrint size={12} /> {prestador.tipo_servico}
                </span>
              ) : null}
            </div>
            {prestador ? (
              <div className="mt-1 text-sm text-slate-600">
                {prestador.servico ? <strong className="font-semibold">{prestador.servico}</strong> : null}
                {prestador.periodo ? <span> · {prestador.periodo}</span> : null}
              </div>
            ) : null}
          </div>
          <div className={styles.consultTime}>
            <Clock size={14} className="mr-1.5" />
            {hora}
          </div>
        </div>

        <div className={styles.detailsDivider} />

        <div>
          <div className={styles.detailsLabel}>
            <AlertCircle size={14} />
            Detalhes do agendamento
          </div>

          <div className={styles.metaGrid}>
            <div className={styles.metaItem} title="Pet">
              <div className={styles.metaIcon}><Dog size={16} /></div>
              <div className={styles.metaText}>{pet?.nome || "Pet não informado"}</div>
              {pet?.especie ? (
                <div className={`${styles.metaText} text-xs opacity-60`}>
                  ({pet.especie}{pet.raca ? ` - ${pet.raca}` : ""})
                </div>
              ) : null}
            </div>

            {pet?.porte ? (
              <div className={styles.metaItem} title="Porte">
                <div className={styles.metaIcon}><Maximize2 size={16} /></div>
                <span
                  className={styles.porteBadgeSmall}
                  data-porte={pet.porte.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}
                >
                  Porte {pet.porte}
                </span>
              </div>
            ) : null}

            <div className={styles.metaItem} title="Valor">
              <div className={styles.metaIcon}><CreditCard size={16} /></div>
              <span className={styles.priceText}>{formatarPreco(agendamento.preco_consulta)}</span>
            </div>

            <div className={styles.metaItem}>
              <StatusBadge status={agendamento.status} />
            </div>
          </div>
        </div>

        {prestador && agendamento.status === "pendente" ? (
          <p className="mt-4 text-sm text-amber-700">Aguardando o profissional aceitar o pedido.</p>
        ) : null}

        {agendamento.codigo_inicio ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-orange-300 bg-orange-50 px-4 py-3">
            <span className="text-sm text-slate-600">
              Código de início: informe ao {prestador ? "profissional" : "veterinário"} no atendimento
            </span>
            <span className="font-mono text-lg font-bold tracking-[0.3em] text-orange-600">
              {agendamento.codigo_inicio}
            </span>
          </div>
        ) : null}

        <div className={`${styles.appointmentFooter} mt-4 flex justify-end gap-3 border-t border-slate-100 pt-4`}>
          {podeAvaliar && onRate ? (
            <button type="button" onClick={() => onRate(agendamento)} className={`${styles.primaryButton} px-4 py-2 text-sm`}>
              {prestador ? "Avaliar Serviço" : "Avaliar Consulta"}
            </button>
          ) : null}

          {agendamento.avaliado ? (
            <span className="flex items-center gap-1 text-sm font-semibold text-green-600">Avaliado</span>
          ) : null}

          {agendamento.pode_cancelar ? (
            <>
              {podeRemarcar ? (
                <button
                  type="button"
                  onClick={() => (prestador ? setRemarcando(true) : onReschedule(agendamento))}
                  className={`${botaoAcao} border-orange-100 text-orange-600 hover:bg-orange-50`}
                >
                  Reagendar
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onCancel(agendamento.id)}
                className={`${botaoAcao} border-red-100 text-red-600 hover:bg-red-50`}
              >
                Cancelar
              </button>
            </>
          ) : null}
        </div>
      </div>

      {remarcando && prestador?.servico_id ? (
        <RemarcarPedidoModal
          pedidoId={agendamento.id}
          prestadorId={prestador.id}
          servicoId={prestador.servico_id}
          modalidade={prestador.modalidade}
          onFechar={() => setRemarcando(false)}
          onRemarcado={() => {
            setRemarcando(false);
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}
