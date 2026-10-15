"use client";

import styles from "../tutor.module.css";
import { ESPECIES, PORTES_PET, RACAS_POR_ESPECIE } from "@/config/pets";
import type { usePetsTutor } from "@/hook/tutor/usePetsTutor";

type Props = { pets: ReturnType<typeof usePetsTutor> };

export function PetModal({ pets }: Props) {
  const { form, setForm, previa, editando, erroForm, salvando } = pets;
  const racas = form.especie ? RACAS_POR_ESPECIE[form.especie] ?? [] : [];

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="pet-modal-titulo">
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <h4 id="pet-modal-titulo" className={styles.modalTitle}>
            {editando ? "Editar Pet" : "Adicionar Pet"}
          </h4>
          <button type="button" className={styles.modalClose} aria-label="Fechar" onClick={pets.fecharModal}>
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.uploader}>
            {previa ? (
              // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou foto atual do pet
              <img src={previa} alt="Prévia da foto do pet" className={styles.uploaderPreview} />
            ) : (
              <div className={styles.uploaderPreview}>Foto</div>
            )}
            <div className={styles.uploaderActions}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                aria-label="Foto do pet"
                onChange={(e) => {
                  pets.escolherArquivo(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formRow}>
              <label htmlFor="pet-nome" className={styles.inputLabel}>Nome</label>
              <input
                id="pet-nome"
                className={styles.input}
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Luna"
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="pet-especie" className={styles.inputLabel}>Espécie</label>
              <select
                id="pet-especie"
                className={styles.input}
                value={form.especie}
                onChange={(e) => {
                  const especie = e.target.value;
                  setForm((f) => ({ ...f, especie, raca: especie === f.especie ? f.raca : "" }));
                }}
              >
                <option value="">Selecione a espécie</option>
                {ESPECIES.map((esp) => (
                  <option key={esp.value} value={esp.value}>{esp.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.formRow}>
              <label htmlFor="pet-raca" className={styles.inputLabel}>Raça</label>
              <select
                id="pet-raca"
                className={styles.input}
                value={form.raca}
                onChange={(e) => setForm((f) => ({ ...f, raca: e.target.value }))}
                disabled={!form.especie}
              >
                <option value="">{form.especie ? "Selecione a raça" : "Selecione a espécie primeiro"}</option>
                {form.raca && !racas.some((r) => r.value === form.raca) ? (
                  <option value={form.raca}>{form.raca}</option>
                ) : null}
                {racas.map((raca) => (
                  <option key={raca.value} value={raca.value}>{raca.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.formRow}>
              <label htmlFor="pet-porte" className={styles.inputLabel}>Porte</label>
              <select
                id="pet-porte"
                className={styles.input}
                value={form.porte}
                onChange={(e) => setForm((f) => ({ ...f, porte: e.target.value }))}
              >
                <option value="">Selecione o porte</option>
                {PORTES_PET.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.formRow}>
              <label htmlFor="pet-idade" className={styles.inputLabel}>Idade (anos)</label>
              <input
                id="pet-idade"
                className={styles.input}
                value={form.idade}
                inputMode="numeric"
                onChange={(e) => setForm((f) => ({ ...f, idade: e.target.value.replace(/\D+/g, "") }))}
                placeholder="Ex.: 3"
              />
            </div>
            {erroForm ? <div className={styles.errorRow} role="alert">{erroForm}</div> : null}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryButton} onClick={pets.fecharModal}>
            Cancelar
          </button>
          {editando ? (
            <button type="button" className={styles.dangerButton} onClick={pets.excluir} disabled={salvando}>
              Excluir
            </button>
          ) : null}
          <button type="button" className={styles.primaryButton} onClick={pets.salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar Pet"}
          </button>
        </div>
      </div>
    </div>
  );
}
