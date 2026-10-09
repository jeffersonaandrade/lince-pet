"use client";

import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { EncaminhamentosService, type Encaminhamento, type StatusEncaminhamento } from "@/services/encaminhamentos/encaminhamentos";
import { handleApiError } from "@/utils/errorHandler";
import ProntuarioPet from "@/components/Prontuario/ProntuarioPet";
import { Alerta, botaoPrimario, botaoSecundario, inputClass } from "@/components/Prestador/ui";
import { SeloEncaminhamento, SeloUrgencia, dataCurta } from "./SeloEncaminhamento";

const ABAS: { id: StatusEncaminhamento; rotulo: string }[] = [
  { id: "enviado", rotulo: "Novos" },
  { id: "aceito", rotulo: "Aceitos" },
  { id: "recusado", rotulo: "Recusados" },
];

function ItemRecebido({ item, onAtualizado }: { item: Encaminhamento; onAtualizado: (e: Encaminhamento) => void }) {
  const [verProntuario, setVerProntuario] = useState(false);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(acao: () => Promise<Encaminhamento>) {
    setSalvando(true);
    setErro(null);
    try {
      onAtualizado(await acao());
    } catch (e) {
      setErro(handleApiError(e).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <li className="space-y-2 rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-800">{item.pet?.nome || "Pet"}</span>
        {item.pet?.especie ? <span className="text-xs text-slate-500">{[item.pet.especie, item.pet.raca].filter(Boolean).join(" · ")}</span> : null}
        <SeloEncaminhamento encaminhamento={item} />
        <SeloUrgencia urgencia={item.urgencia} />
      </div>
      <p className="text-sm text-slate-600">
        Encaminhado por <strong>{item.origem.nome}</strong>
        {item.origem.clinica_nome && item.origem.veterinario_nome ? ` (${item.origem.clinica_nome})` : ""}
        {item.tutor ? ` · Tutor: ${item.tutor.nome}` : ""}
        {item.criado_em ? ` · ${dataCurta(item.criado_em)}` : ""}
      </p>
      <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{item.motivo}</p>
      {item.motivo_recusa ? <p className="text-xs text-red-600">Motivo da recusa: {item.motivo_recusa}</p> : null}
      {item.agendamento_destino?.data ? (
        <p className="text-xs text-blue-700">
          Agendado pelo tutor para {item.agendamento_destino.data.slice(0, 10).split("-").reverse().join("/")}
          {item.agendamento_destino.horario ? ` às ${item.agendamento_destino.horario}` : ""}
        </p>
      ) : item.status === "aceito" ? (
        <p className="text-xs text-slate-500">Aguardando o tutor agendar.</p>
      ) : null}

      {recusando ? (
        <div className="space-y-2">
          <textarea
            className={`${inputClass} min-h-20`}
            placeholder="Motivo da recusa (o tutor verá esta mensagem)"
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <div className="flex gap-2">
            <button className={botaoSecundario} onClick={() => setRecusando(false)} disabled={salvando}>
              Voltar
            </button>
            <button
              className={botaoPrimario}
              disabled={motivo.trim().length < 3 || salvando}
              onClick={() => executar(() => EncaminhamentosService.recusar(item.id, motivo.trim()))}
            >
              Confirmar recusa
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {item.pet && item.status !== "recusado" ? (
            <button className={botaoSecundario} onClick={() => setVerProntuario(!verProntuario)}>
              {verProntuario ? "Ocultar prontuário" : "Ver prontuário"}
            </button>
          ) : null}
          {item.status === "enviado" ? (
            <>
              <button className={botaoSecundario} onClick={() => setRecusando(true)} disabled={salvando}>
                Recusar
              </button>
              <button
                className={botaoPrimario}
                disabled={salvando}
                onClick={() => executar(() => EncaminhamentosService.aceitar(item.id))}
              >
                Aceitar
              </button>
            </>
          ) : null}
        </div>
      )}

      {erro ? <Alerta>{erro}</Alerta> : null}
      {verProntuario && item.pet ? <ProntuarioPet petId={item.pet.id} petNome={item.pet.nome} /> : null}
    </li>
  );
}

/** Encaminhamentos recebidos (vet, clínica ou prestador): aceitar ou recusar com o contexto da consulta. */
export default function PainelRecebidos() {
  const [aba, setAba] = useState<StatusEncaminhamento>("enviado");
  const [lista, setLista] = useState<Encaminhamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setLista(await EncaminhamentosService.recebidos());
    } catch (e) {
      setErro(handleApiError(e).message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const atualizar = (novo: Encaminhamento) => setLista((atual) => atual.map((e) => (e.id === novo.id ? novo : e)));
  const filtrados = lista.filter((e) => e.status === aba);
  const novos = lista.filter((e) => e.status === "enviado").length;

  return (
    <section id="encaminhamentos" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <Send size={18} className="text-orange-500" />
        <h3 className="text-lg font-bold text-slate-800">Encaminhamentos recebidos</h3>
        {novos > 0 ? <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">{novos}</span> : null}
      </div>
      <div className="flex gap-2">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              aba === a.id ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      {carregando ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : erro ? (
        <Alerta>{erro}</Alerta>
      ) : filtrados.length ? (
        <ul className="space-y-3">
          {filtrados.map((e) => (
            <ItemRecebido key={e.id} item={e} onAtualizado={atualizar} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Nenhum encaminhamento aqui.</p>
      )}
    </section>
  );
}
