"use client";

import styles from "../tutor.module.css";
import type { useCancelamentoConsulta } from "@/hook/tutor/useCancelamentoConsulta";
import { MOTIVOS_CANCELAMENTO_TUTOR, type MotivoCancelamentoTutor } from "@/lib/motivos-cancelamento";

const MOTIVOS = Object.entries(MOTIVOS_CANCELAMENTO_TUTOR) as [MotivoCancelamentoTutor, string][];

export function CancelamentoModal({ cancelamento }: { cancelamento: ReturnType<typeof useCancelamentoConsulta> }) {
  const { motivo, erro, enviando } = cancelamento;
  if (!cancelamento.aberto) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="cancelar-titulo">
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <h4 id="cancelar-titulo" className={styles.modalTitle}>Cancelar Consulta</h4>
          <button type="button" className={styles.modalClose} aria-label="Fechar" onClick={cancelamento.fechar}>
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className={`${styles.inputLabel} mb-2`}>Qual o motivo? O profissional será avisado.</legend>
            {MOTIVOS.map(([codigo, texto]) => (
              <label
                key={codigo}
                className={
                  codigo === motivo
                    ? "flex cursor-pointer items-center gap-2 rounded-md border-2 border-orange-500 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700"
                    : "flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:border-orange-300"
                }
              >
                <input
                  type="radio"
                  name="motivo-cancelamento"
                  value={codigo}
                  checked={codigo === motivo}
                  onChange={() => cancelamento.setMotivo(codigo)}
                  className="accent-orange-500"
                />
                {texto}
              </label>
            ))}
          </fieldset>
          {erro ? <div className={`${styles.errorRow} mt-3`} role="alert">{erro}</div> : null}
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryButton} onClick={cancelamento.fechar}>
            Voltar
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={enviando || !motivo}
            onClick={cancelamento.confirmar}
          >
            {enviando ? "Cancelando..." : "Confirmar Cancelamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
