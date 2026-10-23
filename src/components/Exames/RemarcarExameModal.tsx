"use client";

import { useEffect, useState } from "react";
import { mensagemDeErro } from "@/lib/erros";
import { ExamesService } from "@/services/exames/exames";
import { botaoPrimario, botaoSecundario, Campo, campo, Mensagem } from "./ui";

const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export function RemarcarExameModal({ agendamentoId, onFechar, onRemarcado }: { agendamentoId: string; onFechar: () => void; onRemarcado: () => void }) {
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [horarios, setHorarios] = useState<string[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    let ativo = true;
    setHorario("");
    setHorarios(null);
    ExamesService.disponibilidadeParaRemarcar(agendamentoId, data)
      .then((r) => ativo && setHorarios(r.horarios))
      .catch((e) => {
        if (!ativo) return;
        setHorarios([]);
        setErro(mensagemDeErro(e, "Não foi possível carregar os horários."));
      });
    return () => {
      ativo = false;
    };
  }, [data, agendamentoId]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await ExamesService.remarcar(agendamentoId, data, horario);
      onRemarcado();
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível remarcar o exame."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Remarcar exame">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-bold text-slate-800">Remarcar exame</h4>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <Campo rotulo="Nova data">
          <input type="date" className={campo} min={hoje()} value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
        {data && horarios === null ? <p className="text-sm text-slate-500">Carregando horários...</p> : null}
        {horarios?.length ? (
          <div className="flex flex-wrap gap-2">
            {horarios.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorario(h)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${horario === h ? "border-orange-500 bg-orange-500 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                {h}
              </button>
            ))}
          </div>
        ) : null}
        {data && horarios?.length === 0 ? <p className="text-sm text-slate-500">Sem horários livres nesse dia.</p> : null}
        <Mensagem texto={erro} />
        <div className="flex justify-end gap-2">
          <button type="button" className={botaoSecundario} onClick={onFechar}>
            Voltar
          </button>
          <button type="button" className={botaoPrimario} disabled={!horario || salvando} onClick={salvar}>
            {salvando ? "Salvando..." : "Remarcar"}
          </button>
        </div>
      </div>
    </div>
  );
}
