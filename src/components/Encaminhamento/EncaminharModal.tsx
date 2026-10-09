"use client";

import { useEffect, useState } from "react";
import {
  EncaminhamentosService,
  ROTULO_DESTINO,
  type DestinoOpcao,
  type DestinoTipo,
  type Encaminhamento,
  type Urgencia,
} from "@/services/encaminhamentos/encaminhamentos";
import { handleApiError } from "@/utils/errorHandler";
import { Alerta, Campo, Entrada, botaoPrimario, botaoSecundario, inputClass } from "@/components/Prestador/ui";
import { SeloEncaminhamento, SeloUrgencia } from "./SeloEncaminhamento";

type Props = {
  agendamentoId: string | number;
  petNome?: string | null;
  onFechar: () => void;
};

const TIPOS: DestinoTipo[] = ["clinica", "veterinario", "prestador"];

/** Vet ou clínica encaminham o pet da consulta para outra clínica, especialista ou profissional pet. */
export default function EncaminharModal({ agendamentoId, petNome, onFechar }: Props) {
  const [tipo, setTipo] = useState<DestinoTipo>("clinica");
  const [termo, setTermo] = useState("");
  const [opcoes, setOpcoes] = useState<DestinoOpcao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [destino, setDestino] = useState<DestinoOpcao | null>(null);
  const [motivo, setMotivo] = useState("");
  const [urgencia, setUrgencia] = useState<Urgencia>("rotina");
  const [enviados, setEnviados] = useState<Encaminhamento[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    EncaminhamentosService.daConsulta(agendamentoId).then(setEnviados).catch(() => setEnviados([]));
  }, [agendamentoId]);

  useEffect(() => {
    let ativo = true;
    setBuscando(true);
    const t = setTimeout(() => {
      EncaminhamentosService.buscarDestinos(tipo, termo)
        .then((r) => ativo && setOpcoes(r.slice(0, 20)))
        .catch(() => ativo && setOpcoes([]))
        .finally(() => ativo && setBuscando(false));
    }, 300);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [tipo, termo]);

  function trocarTipo(novo: DestinoTipo) {
    setTipo(novo);
    setDestino(null);
  }

  async function enviar() {
    if (!destino) return;
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const novo = await EncaminhamentosService.enviar(agendamentoId, {
        destino_tipo: tipo,
        destino_id: destino.id,
        motivo: motivo.trim(),
        urgencia,
      });
      setEnviados((atual) => [novo, ...atual]);
      setSucesso(`Encaminhamento enviado para ${destino.nome}. O tutor acompanha o status pelo painel.`);
      setDestino(null);
      setMotivo("");
      setUrgencia("rotina");
    } catch (e) {
      setErro(handleApiError(e).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-bold text-slate-800">Encaminhar {petNome || "pet"}</h4>
          <button onClick={onFechar} aria-label="Fechar" className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="flex gap-2">
          {TIPOS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => trocarTipo(t)}
              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${
                tipo === t ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {ROTULO_DESTINO[t]}
            </button>
          ))}
        </div>

        <Campo label="Destino">
          <Entrada
            placeholder={tipo === "prestador" ? "Nome ou tipo de serviço" : "Nome, especialidade ou cidade"}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
        </Campo>

        <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-1">
          {buscando ? (
            <p className="p-3 text-sm text-slate-500">Buscando...</p>
          ) : opcoes.length ? (
            opcoes.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setDestino(o)}
                className={`block w-full rounded-lg px-3 py-2 text-left ${
                  destino?.id === o.id ? "bg-orange-50 ring-1 ring-orange-300" : "hover:bg-slate-50"
                }`}
              >
                <span className="block text-sm font-semibold text-slate-800">{o.nome}</span>
                {o.detalhe ? <span className="block text-xs text-slate-500">{o.detalhe}</span> : null}
              </button>
            ))
          ) : (
            <p className="p-3 text-sm text-slate-500">Nenhum resultado.</p>
          )}
        </div>

        <Campo label="Motivo e contexto" dica="Ex.: suspeita de displasia, solicitar avaliação ortopédica e raio-x.">
          <textarea
            className={`${inputClass} min-h-24`}
            maxLength={2000}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </Campo>

        <Campo label="Urgência">
          <select className={inputClass} value={urgencia} onChange={(e) => setUrgencia(e.target.value as Urgencia)}>
            <option value="rotina">Rotina</option>
            <option value="prioritario">Prioritário</option>
          </select>
        </Campo>

        {erro ? <Alerta>{erro}</Alerta> : null}
        {sucesso ? <Alerta tipo="sucesso">{sucesso}</Alerta> : null}

        <div className="flex justify-end gap-2">
          <button className={botaoSecundario} onClick={onFechar}>
            Fechar
          </button>
          <button className={botaoPrimario} disabled={!destino || motivo.trim().length < 3 || salvando} onClick={enviar}>
            {salvando ? "Enviando..." : "Enviar encaminhamento"}
          </button>
        </div>

        {enviados.length ? (
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-700">Encaminhamentos desta consulta</p>
            {enviados.map((e) => (
              <div key={e.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{e.destino.nome}</span>
                  <span className="text-xs text-slate-500">{e.destino.rotulo}</span>
                  <SeloEncaminhamento encaminhamento={e} />
                  <SeloUrgencia urgencia={e.urgencia} />
                </div>
                {e.motivo_recusa ? <p className="mt-1 text-xs text-red-600">Motivo da recusa: {e.motivo_recusa}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
