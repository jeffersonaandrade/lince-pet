"use client";

import { useState } from "react";
import { Dog, MapPin, MessageSquare } from "lucide-react";
import { PrestadoresService, type Pedido } from "@/services/prestadores/prestadores";
import { handleApiError } from "@/utils/errorHandler";
import { Alerta, SeloStatus, botaoPrimario, botaoSecundario, formatarPeriodo, formatarPreco, inputClass } from "./ui";

const ABAS = [
  { id: "pendentes", rotulo: "Novos pedidos", status: ["pendente"] },
  { id: "agenda", rotulo: "Agenda", status: ["confirmado", "em andamento"] },
  { id: "historico", rotulo: "Histórico", status: ["realizado", "cancelado"] },
] as const;

type Aba = (typeof ABAS)[number]["id"];

export function PainelPedidos({ pedidos, onAtualizado }: { pedidos: Pedido[]; onAtualizado: (p: Pedido) => void }) {
  const [aba, setAba] = useState<Aba>("pendentes");
  const atual = ABAS.find((a) => a.id === aba)!;
  const lista = pedidos.filter((p) => (atual.status as readonly string[]).includes(p.status));
  const contagem = (id: Aba) => {
    const a = ABAS.find((x) => x.id === id)!;
    return pedidos.filter((p) => (a.status as readonly string[]).includes(p.status)).length;
  };

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap gap-2" role="tablist">
        {ABAS.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              aba === a.id ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {a.rotulo} <span className="ml-1 opacity-80">({contagem(a.id)})</span>
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Nada por aqui.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {lista.map((p) => (
            <ItemPedido key={p.id} pedido={p} onAtualizado={onAtualizado} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemPedido({ pedido, onAtualizado }: { pedido: Pedido; onAtualizado: (p: Pedido) => void }) {
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const executar = async (acao: () => Promise<Pedido>) => {
    setOcupado(true);
    setErro(null);
    try {
      onAtualizado(await acao());
      setCodigo("");
    } catch (e) {
      setErro(handleApiError(e).message);
    } finally {
      setOcupado(false);
    }
  };

  const recusar = () => {
    const motivo = window.prompt(
      pedido.status === "pendente" ? "Motivo da recusa (opcional):" : "Motivo do cancelamento (opcional):"
    );
    if (motivo === null) return;
    executar(() => PrestadoresService.recusar(pedido.id, motivo || undefined));
  };

  return (
    <li className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold text-slate-800">{pedido.servico?.nome || "Serviço"}</span>
          <span className="text-sm text-slate-600">{formatarPeriodo(pedido.inicio_em, pedido.fim_em)}</span>
        </div>
        <SeloStatus status={pedido.status} />
      </div>

      <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
        <span className="flex items-center gap-2">
          <Dog size={16} className="text-orange-500" />
          {pedido.pet?.nome || "Pet"}
          {pedido.pet?.especie ? <span className="text-slate-400">({pedido.pet.especie})</span> : null}
          {pedido.tutor?.nome ? <span className="text-slate-400">· {pedido.tutor.nome}</span> : null}
        </span>
        <span className="flex items-center gap-2">
          <MapPin size={16} className="text-orange-500" />
          {pedido.local_nome || "Local não informado"}
          {pedido.local_endereco ? <span className="text-slate-400">· {pedido.local_endereco}</span> : null}
        </span>
        {pedido.observacoes ? (
          <span className="flex items-start gap-2 sm:col-span-2">
            <MessageSquare size={16} className="mt-0.5 shrink-0 text-orange-500" />
            {pedido.observacoes}
          </span>
        ) : null}
        {pedido.motivo_cancelamento ? (
          <span className="text-red-600 sm:col-span-2">Motivo: {pedido.motivo_cancelamento}</span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-base font-bold text-slate-800">{formatarPreco(pedido.preco)}</span>
        <div className="flex flex-wrap items-center gap-2">
          {pedido.status === "pendente" ? (
            <>
              <button className={botaoSecundario} disabled={ocupado} onClick={recusar}>
                Recusar
              </button>
              <button
                className={botaoPrimario}
                disabled={ocupado}
                onClick={() => executar(() => PrestadoresService.aceitar(pedido.id))}
              >
                Aceitar
              </button>
            </>
          ) : null}
          {pedido.status === "confirmado" ? (
            <>
              <button className={botaoSecundario} disabled={ocupado} onClick={recusar}>
                Cancelar
              </button>
              <input
                aria-label="Código de início informado pelo tutor"
                placeholder="Código do tutor"
                inputMode="numeric"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                className={`${inputClass} w-40 py-2.5 font-mono tracking-widest`}
              />
              <button
                className={botaoPrimario}
                disabled={ocupado || codigo.length !== 6}
                onClick={() => executar(() => PrestadoresService.iniciar(pedido.id, codigo))}
              >
                Iniciar
              </button>
            </>
          ) : null}
          {pedido.status === "em andamento" ? (
            <button
              className={botaoPrimario}
              disabled={ocupado}
              onClick={() => executar(() => PrestadoresService.concluir(pedido.id))}
            >
              Concluir
            </button>
          ) : null}
        </div>
      </div>
      {erro ? (
        <div className="mt-3">
          <Alerta>{erro}</Alerta>
        </div>
      ) : null}
    </li>
  );
}
