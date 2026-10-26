"use client";

import { useState, type ReactNode } from "react";
import { PrestadoresService, type Pedido } from "@/services/prestadores/prestadores";
import { handleApiError } from "@/utils/errorHandler";
import { Alerta, SeloStatus, botaoPrimario, botaoSecundario, formatarPreco, inputClass } from "./ui";

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
        <ul className="flex list-none flex-col gap-4 p-0">
          {lista.map((p) => (
            <ItemPedido key={p.id} pedido={p} onAtualizado={onAtualizado} />
          ))}
        </ul>
      )}
    </section>
  );
}

const FUSO = "America/Sao_Paulo";

function partesDoPeriodo(inicio: string | null, fim: string | null) {
  if (!inicio) return null;
  const i = new Date(inicio);
  const f = fim ? new Date(fim) : i;
  const opcoes = { timeZone: FUSO } as const;
  const semana = (d: Date) => d.toLocaleDateString("pt-BR", { ...opcoes, weekday: "short" }).replace(".", "");
  const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { ...opcoes, hour: "2-digit", minute: "2-digit" });
  const dia = (d: Date) => d.toLocaleDateString("pt-BR", { ...opcoes, day: "2-digit" });
  const mes = (d: Date) => d.toLocaleDateString("pt-BR", { ...opcoes, month: "short" }).replace(".", "");
  const mesmoDia = dia(i) === dia(f) && mes(i) === mes(f);
  return {
    semana: semana(i),
    dia: dia(i),
    mes: mesmoDia ? mes(i) : `${mes(i)}–${mes(f)}`,
    inicio: hora(i),
    fim: hora(f),
  };
}

function nomeDoLocal(nome: string | null) {
  if (nome === "Domicílio do tutor") return "Na casa do tutor";
  if (nome === "Local do profissional") return "No seu espaço";
  return nome || "Local não informado";
}

function soBairro(endereco: string | null) {
  return Boolean(endereco?.startsWith("Bairro"));
}

function Fato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function Onde({ pedido }: { pedido: Pedido }) {
  const endereco = pedido.local_endereco;
  const restrito = pedido.local_nome === "Domicílio do tutor" && soBairro(endereco);
  const mapa = endereco && !soBairro(endereco) ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}` : null;

  return (
    <Fato rotulo="Onde">
      <span className="block font-medium">{nomeDoLocal(pedido.local_nome)}</span>
      {endereco ? <span className="mt-0.5 block text-slate-600">{endereco}</span> : null}
      {restrito ? (
        <span className="mt-1 block text-slate-500">A rua aparece depois que você aceitar.</span>
      ) : null}
      {mapa ? (
        <a href={mapa} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex font-semibold text-orange-600 hover:underline">
          Abrir no mapa
        </a>
      ) : null}
    </Fato>
  );
}

function ItemPedido({ pedido, onAtualizado }: { pedido: Pedido; onAtualizado: (p: Pedido) => void }) {
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const quando = partesDoPeriodo(pedido.inicio_em, pedido.fim_em);
  const pet = [pedido.pet?.nome || "Pet", pedido.pet?.especie, pedido.pet?.raca].filter(Boolean).join(" · ");

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
      <div className="flex gap-3">
        {quando ? (
          <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-orange-50 px-1 py-2 text-center text-orange-800">
            <span className="text-xs font-semibold capitalize">{quando.semana}</span>
            <span className="text-lg font-bold leading-none">{quando.dia}</span>
            <span className="text-xs capitalize">{quando.mes}</span>
            <span className="mt-1 text-xs leading-tight">{quando.inicio}</span>
            <span className="text-xs leading-none text-orange-600">às</span>
            <span className="text-xs leading-tight">{quando.fim}</span>
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-800">{pedido.servico?.nome || "Serviço"}</h3>
            <p className="text-sm font-semibold text-slate-700">{formatarPreco(pedido.preco)}</p>
          </div>
          <SeloStatus status={pedido.status} />
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Fato rotulo="Pet">{pet}</Fato>
        <Fato rotulo="Tutor">
          <span className="block">{pedido.tutor?.nome || "Tutor não informado"}</span>
          {pedido.tutor?.celular ? (
            <a href={`tel:${pedido.tutor.celular}`} className="mt-0.5 inline-flex font-semibold text-orange-600 hover:underline">
              {pedido.tutor.celular}
            </a>
          ) : null}
        </Fato>
        <div className="sm:col-span-2">
          <Onde pedido={pedido} />
        </div>
      </dl>

      {pedido.observacoes ? (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <span className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Observação</span>
          {pedido.observacoes}
        </p>
      ) : null}
      {pedido.motivo_cancelamento ? (
        <p className="mt-3 text-sm text-red-700">Motivo: {pedido.motivo_cancelamento}</p>
      ) : null}

      <AcoesPedido
        pedido={pedido}
        ocupado={ocupado}
        codigo={codigo}
        onCodigo={setCodigo}
        onRecusar={recusar}
        onAceitar={() => executar(() => PrestadoresService.aceitar(pedido.id))}
        onIniciar={() => executar(() => PrestadoresService.iniciar(pedido.id, codigo))}
        onConcluir={() => executar(() => PrestadoresService.concluir(pedido.id))}
      />
      {erro ? (
        <div className="mt-3">
          <Alerta>{erro}</Alerta>
        </div>
      ) : null}
    </li>
  );
}

function AcoesPedido({
  pedido,
  ocupado,
  codigo,
  onCodigo,
  onRecusar,
  onAceitar,
  onIniciar,
  onConcluir,
}: {
  pedido: Pedido;
  ocupado: boolean;
  codigo: string;
  onCodigo: (codigo: string) => void;
  onRecusar: () => void;
  onAceitar: () => void;
  onIniciar: () => void;
  onConcluir: () => void;
}) {
  if (pedido.status !== "pendente" && pedido.status !== "confirmado" && pedido.status !== "em andamento") return null;

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
      {pedido.status === "confirmado" ? (
        <label className="flex max-w-xs flex-col gap-1.5 text-sm font-semibold text-slate-700">
          Código do tutor
          <span className="font-normal text-slate-500">Peça os 6 dígitos ao tutor para começar.</span>
          <input
            aria-label="Código de início informado pelo tutor"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            onChange={(e) => onCodigo(e.target.value.replace(/\D/g, ""))}
            className={`${inputClass} py-2.5 text-center font-mono text-base tracking-[0.3em]`}
          />
        </label>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {pedido.status === "pendente" ? (
          <>
            <button className={botaoSecundario} disabled={ocupado} onClick={onRecusar}>
              Recusar
            </button>
            <button className={botaoPrimario} disabled={ocupado} onClick={onAceitar}>
              Aceitar pedido
            </button>
          </>
        ) : null}
        {pedido.status === "confirmado" ? (
          <>
            <button className={botaoSecundario} disabled={ocupado} onClick={onRecusar}>
              Cancelar
            </button>
            <button className={botaoPrimario} disabled={ocupado || codigo.length !== 6} onClick={onIniciar}>
              Iniciar atendimento
            </button>
          </>
        ) : null}
        {pedido.status === "em andamento" ? (
          <button className={botaoPrimario} disabled={ocupado} onClick={onConcluir}>
            Concluir atendimento
          </button>
        ) : null}
      </div>
    </div>
  );
}
