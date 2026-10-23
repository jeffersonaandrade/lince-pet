"use client";

import { useState, type FormEvent } from "react";
import AvisoAnalise from "@/components/AvisoAnalise/AvisoAnalise";
import { mensagemDeErro } from "@/lib/erros";
import { ExamesClinicaService, type ResponsavelTecnico } from "@/services/exames/exames";
import { botaoPrimario, Campo, campo, Mensagem, Secao } from "./ui";

/** RT da clínica: a equipe Lince aprova antes dos exames aparecerem na busca. */
export function FormResponsavelTecnico({ rt, onSalvo }: { rt: ResponsavelTecnico; onSalvo: (rt: ResponsavelTecnico) => void }) {
  const [nome, setNome] = useState(rt.rt_nome ?? "");
  const [crmv, setCrmv] = useState(rt.rt_crmv ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    setOk(null);
    try {
      const salvo = await ExamesClinicaService.salvarRt({ rt_nome: nome, rt_crmv: crmv });
      onSalvo(salvo);
      setOk(salvo.rt_status === "aprovado" ? "Dados salvos." : "Enviado para análise da equipe Lince Pet.");
    } catch (error) {
      setErro(mensagemDeErro(error, "Não foi possível salvar o responsável técnico."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Secao
      titulo="Responsável técnico"
      descricao="Veterinário responsável pelos exames. Os exames só aparecem na busca depois que a equipe Lince Pet aprovar o RT."
    >
      <AvisoAnalise
        item="O responsável técnico"
        status={rt.rt_status}
        motivo={rt.rt_motivo}
        consequencia="Você já pode cadastrar exames, mas eles só aparecem para os tutores depois da aprovação."
      />
      {rt.rt_status === "aprovado" ? (
        <p className="mb-3 text-sm font-medium text-emerald-700">Responsável técnico aprovado.</p>
      ) : null}
      <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
        <Campo rotulo="Nome do responsável técnico">
          <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} required minLength={3} maxLength={255} />
        </Campo>
        <Campo rotulo="CRMV do responsável técnico">
          <input
            className={campo}
            value={crmv}
            onChange={(e) => setCrmv(e.target.value.toUpperCase())}
            placeholder="12345-SP"
            required
            pattern="\d+-[A-Za-z]{2}"
          />
        </Campo>
        <button type="submit" className={botaoPrimario} disabled={salvando}>
          {salvando ? "Salvando..." : "Enviar para análise"}
        </button>
      </form>
      <Mensagem texto={erro} />
      <Mensagem texto={ok} tipo="ok" />
    </Secao>
  );
}
