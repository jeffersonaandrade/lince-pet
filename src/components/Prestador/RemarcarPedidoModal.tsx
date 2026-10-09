"use client";

import { useEffect, useState } from "react";
import { PrestadoresService } from "@/services/prestadores/prestadores";
import { Alerta, Campo, Entrada, botaoPrimario, botaoSecundario } from "./ui";

type Props = {
  pedidoId: string;
  prestadorId: string;
  servicoId: string;
  modalidade: "duracao" | "periodo";
  onFechar: () => void;
  onRemarcado: () => void;
};

const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export function RemarcarPedidoModal({ pedidoId, prestadorId, servicoId, modalidade, onFechar, onRemarcado }: Props) {
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [horarioFim, setHorarioFim] = useState("");
  const [horarios, setHorarios] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    let ativo = true;
    setCarregando(true);
    setHorario("");
    PrestadoresService.disponibilidade(prestadorId, servicoId, data)
      .then((r) => ativo && setHorarios(r.horarios))
      .catch(() => ativo && setHorarios([]))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [data, prestadorId, servicoId]);

  const periodo = modalidade === "periodo";
  const completo = data && horario && (!periodo || (dataFim && horarioFim));

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await PrestadoresService.remarcarPedido(pedidoId, {
        data,
        horario,
        data_fim: periodo ? dataFim : null,
        horario_fim: periodo ? horarioFim : null,
      });
      onRemarcado();
    } catch (e: any) {
      setErro(e?.response?.data?.message || e?.message || "Não foi possível remarcar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-bold text-slate-800">Remarcar pedido</h4>
          <button onClick={onFechar} aria-label="Fechar" className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <p className="text-sm text-slate-500">O profissional precisa aceitar o novo horário.</p>

        <Campo label={periodo ? "Entrada" : "Data"}>
          <Entrada type="date" min={hoje()} value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>

        {data ? (
          carregando ? (
            <p className="text-sm text-slate-500">Carregando horários...</p>
          ) : horarios.length ? (
            <div className="flex flex-wrap gap-2">
              {horarios.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorario(h)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                    horario === h ? "border-orange-500 bg-orange-500 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          ) : (
            <Alerta tipo="info">Sem horários livres nesse dia.</Alerta>
          )
        ) : null}

        {periodo ? (
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Saída">
              <Entrada type="date" min={data || hoje()} value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </Campo>
            <Campo label="Horário de saída">
              <Entrada type="time" value={horarioFim} onChange={(e) => setHorarioFim(e.target.value)} />
            </Campo>
          </div>
        ) : null}

        {erro ? <Alerta>{erro}</Alerta> : null}

        <div className="flex justify-end gap-2">
          <button className={botaoSecundario} onClick={onFechar}>
            Voltar
          </button>
          <button className={botaoPrimario} disabled={!completo || salvando} onClick={salvar}>
            {salvando ? "Salvando..." : "Remarcar"}
          </button>
        </div>
      </div>
    </div>
  );
}
