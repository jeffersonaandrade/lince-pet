import React, { useState } from "react";
import styles from "./tutor.module.css";
import {
  Clock,
  MapPin,
  Dog,
  AlertCircle,
  CreditCard,
  Maximize2,
  PawPrint
} from "lucide-react";
import { RemarcarPedidoModal } from "@/components/Prestador/RemarcarPedidoModal";

interface AppointmentItemProps {
  agendamento: any;
  statusBadge: (status?: string) => React.ReactNode;
  onCancel: (id: string) => void;
  onRate?: (agendamento: any) => void;
  onReschedule?: (agendamento: any) => void;
  onChanged?: () => void;
  canRate?: boolean; // Keep for compatibility
  isRated?: boolean; // Keep for compatibility
}

export function AppointmentItem({
  agendamento,
  statusBadge,
  onCancel,
  onRate,
  onReschedule,
  onChanged,
  canRate,
  isRated,
}: AppointmentItemProps) {
  const [remarcando, setRemarcando] = useState(false);
  const prestador = agendamento.prestador;
  const profissional = prestador
    ? `${prestador.nome} ${prestador.sobrenome || ""}`.trim()
    : `Dr(a). ${`${agendamento.veterinario?.nome || ""} ${agendamento.veterinario?.sobrenome || ""}`.trim()}`;
  const locationName = agendamento.local_nome || "Local não informado";
  const locationAddress = agendamento.local_endereco || "";
  const hour = agendamento.horario_consulta?.substring(0, 5) || "--:--";
  const pet = agendamento.pet;
  const canCancel = agendamento.pode_cancelar;

  // Use props if provided, otherwise derive from agendamento
  const finalCanRate = canRate !== undefined ? canRate : (agendamento.ja_passou && !agendamento.avaliado && agendamento.status === "realizado");
  const finalIsRated = isRated !== undefined ? isRated : agendamento.avaliado;

  return (
    <div className={styles.appointmentItem}>
      <div className={styles.appointmentDetailSection}>
        {/* Main Info Row */}
        <div className={styles.appointmentMainInfo}>
          <div>
            <div className={styles.appointmentLocationName}>
              <MapPin size={18} className={styles.metaIcon} />
              {locationName}
            </div>
            {locationAddress && (
              <div className={styles.appointmentLocationAddress}>
                {locationAddress}
              </div>
            )}
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
                {profissional}
              </span>
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
            <Clock size={14} style={{ marginRight: 6 }} />
            {hour}
          </div>
        </div>

        <div className={styles.detailsDivider} />

        {/* Details Section */}
        <div>
          <div className={styles.detailsLabel}>
            <AlertCircle size={14} />
            Detalhes do agendamento
          </div>

          <div className={styles.metaGrid}>
            {/* Pet Info */}
            <div className={styles.metaItem} title="Pet">
              <div className={styles.metaIcon}><Dog size={16} /></div>
              <div className={styles.metaText}>{pet?.nome || "Pet não informado"}</div>
              {pet?.especie && (
                <div className={styles.metaText} style={{ opacity: 0.6, fontSize: '0.8rem' }}>
                  ({pet.especie}{pet.raca ? ` - ${pet.raca}` : ""})
                </div>
              )}
            </div>

            {/* Porte */}
            {pet?.porte && (
              <div className={styles.metaItem} title="Porte">
                <div className={styles.metaIcon}><Maximize2 size={16} /></div>
                <span
                  className={styles.porteBadgeSmall}
                  data-porte={pet.porte.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}
                >
                  Porte {pet.porte}
                </span>
              </div>
            )}

            {/* Price */}
            <div className={styles.metaItem} title="Valor">
              <div className={styles.metaIcon}><CreditCard size={16} /></div>
              <span className={styles.priceText}>
                {agendamento.preco_consulta
                  ? `R$ ${Number(agendamento.preco_consulta).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : "Não informado"
                }
              </span>
            </div>

            {/* Status */}
            <div className={styles.metaItem}>
              {statusBadge(agendamento.status)}
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

        {/* Footer Actions */}
        <div className={styles.appointmentFooter} style={{ marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          {finalCanRate && (
            <button
              onClick={() => onRate?.(agendamento)}
              className={styles.primaryButton}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              {prestador ? "Avaliar Serviço" : "Avaliar Consulta"}
            </button>
          )}

          {finalIsRated && (
            <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              Avaliado
            </span>
          )}
          {canCancel && (
            <>
              <button
                onClick={() => (prestador ? setRemarcando(true) : onReschedule?.(agendamento))}
                className={styles.secondaryButton}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#e67e22', borderColor: '#f8e8daff', background: '#fff' }}
              >
                Reagendar
              </button>
              <button
                onClick={() => onCancel(agendamento.id)}
                className={styles.secondaryButton}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#dc2626', borderColor: '#fee2e2', background: '#fff' }}
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {remarcando && prestador ? (
        <RemarcarPedidoModal
          pedidoId={agendamento.id}
          prestadorId={prestador.id}
          servicoId={prestador.servico_id}
          modalidade={prestador.modalidade}
          onFechar={() => setRemarcando(false)}
          onRemarcado={() => {
            setRemarcando(false);
            onChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}
