"use client";

import styles from "../tutor.module.css";
import type { useReagendamento } from "@/hook/tutor/useReagendamento";

const hojeIso = () => {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
};

export function ReagendamentoModal({ reagendamento }: { reagendamento: ReturnType<typeof useReagendamento> }) {
  const { data, horario, horarios, carregandoHorarios, erro, enviando } = reagendamento;
  if (!reagendamento.aberto) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="reagendar-titulo">
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <h4 id="reagendar-titulo" className={styles.modalTitle}>Reagendar Consulta</h4>
          <button type="button" className={styles.modalClose} aria-label="Fechar" onClick={reagendamento.fechar}>
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formGrid}>
            <div className={styles.formRow}>
              <label htmlFor="reagendar-data" className={styles.inputLabel}>Nova Data</label>
              <input
                id="reagendar-data"
                type="date"
                className={styles.input}
                value={data}
                min={hojeIso()}
                onChange={(e) => reagendamento.setData(e.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <span className={styles.inputLabel}>Novo Horário</span>
              {carregandoHorarios ? (
                <p className={`${styles.muted} text-sm`}>Buscando horários disponíveis...</p>
              ) : horarios.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {horarios.map((h) => (
                    <button
                      key={h}
                      type="button"
                      aria-pressed={h === horario}
                      onClick={() => reagendamento.setHorario(h)}
                      className={
                        h === horario
                          ? "cursor-pointer rounded-md border-2 border-orange-500 bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-700 transition"
                          : "cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:border-orange-300"
                      }
                    >
                      {h}
                    </button>
                  ))}
                </div>
              ) : data ? (
                <p className="m-0 text-sm text-red-600">Nenhum horário disponível para esta data e/ou local.</p>
              ) : (
                <p className={`${styles.muted} m-0 text-sm`}>Selecione uma data primeiro para carregar os horários.</p>
              )}
            </div>
            {erro ? <div className={styles.errorRow} role="alert">{erro}</div> : null}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryButton} onClick={reagendamento.fechar}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={enviando || !data || !horario}
            onClick={reagendamento.confirmar}
          >
            {enviando ? "Salvando..." : "Confirmar Reagendamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
