"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { urlDeLogin } from "@/lib/destino-login";
import { AprovacoesService, type CrmvPendente, type Decisao, type RtPendente } from "@/services/admin/aprovacoes";
import AdminNav from "@/components/AdminNav/AdminNav";

type Pedido = {
  id: string;
  titulo: string;
  detalhe: string;
  linhas: string[];
  email: string | null;
  enviadoEm: string | null;
};

const BOTAO = "inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50";

const dataCurta = (iso: string | null) => {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(data);
};

const textoCrmv = (crmv: string | null, uf: string | null) => `CRMV ${crmv ?? "-"}${uf ? ` (${uf})` : ""}`;

const pedidoDoVet = (v: CrmvPendente): Pedido => ({
  id: v.id,
  titulo: v.nome,
  detalhe: textoCrmv(v.crmv, v.uf),
  linhas: [],
  email: v.email,
  enviadoEm: v.enviado_em,
});

const pedidoDaClinica = (c: RtPendente): Pedido => ({
  id: c.id,
  titulo: c.nome,
  detalhe: `RT: ${c.rt_nome ?? "-"} - ${textoCrmv(c.rt_crmv, c.uf)}`,
  linhas: [[c.cidade, c.estado].filter(Boolean).join(" - "), c.cnpj ? `CNPJ ${c.cnpj}` : ""].filter(Boolean),
  email: c.email,
  enviadoEm: c.enviado_em,
});

function CartaoPedido({ pedido, onDecidir }: { pedido: Pedido; onDecidir: (d: Decisao) => Promise<void> }) {
  const [reprovando, setReprovando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const campoMotivo = useRef<HTMLTextAreaElement>(null);
  const idMotivo = `motivo-${pedido.id}`;

  useEffect(() => {
    if (reprovando) campoMotivo.current?.focus();
  }, [reprovando]);

  const decidir = async (d: Decisao) => {
    setEnviando(true);
    try {
      await onDecidir(d);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={pedido.titulo} aria-busy={enviando}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-pretty break-words text-lg font-bold text-slate-900">{pedido.titulo}</h3>
          <p className="mt-1 break-words font-semibold text-slate-800">{pedido.detalhe}</p>
          {pedido.linhas.map((linha) => (
            <p key={linha} className="mt-1 break-words text-sm text-slate-500">{linha}</p>
          ))}
          {pedido.email ? (
            <a href={`mailto:${pedido.email}`} className="mt-1 inline-block break-all text-sm font-semibold text-orange-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
              {pedido.email}
            </a>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">
          Enviado em <time dateTime={pedido.enviadoEm ?? undefined}>{dataCurta(pedido.enviadoEm)}</time>
        </p>
      </div>
      {reprovando ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={idMotivo} className="text-sm font-medium text-slate-700">Motivo da reprovação</label>
          <textarea
            ref={campoMotivo}
            id={idMotivo}
            name="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={500}
            rows={3}
            autoComplete="off"
            spellCheck
            aria-describedby={`${idMotivo}-ajuda`}
            placeholder="Descreva o que não foi confirmado…"
            className="rounded-lg border border-slate-300 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id={`${idMotivo}-ajuda`} className="text-xs text-slate-500">O usuário recebe este texto.</p>
            <p className="text-xs tabular-nums text-slate-400">{motivo.trim().length}/500</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={enviando || !motivo.trim()}
              onClick={() => decidir({ decisao: "reprovar", motivo: motivo.trim() })}
              className={`${BOTAO} bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-700`}
            >
              {enviando ? "Reprovando…" : "Confirmar reprovação"}
            </button>
            <button
              type="button"
              onClick={() => setReprovando(false)}
              className={`${BOTAO} border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400`}
            >
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={enviando}
            onClick={() => decidir({ decisao: "aprovar" })}
            className={`${BOTAO} bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-700`}
          >
            <Check size={16} aria-hidden="true" /> {enviando ? "Aprovando…" : "Aprovar"}
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={() => setReprovando(true)}
            className={`${BOTAO} border border-red-200 text-red-700 hover:bg-red-50 focus-visible:ring-red-600`}
          >
            <X size={16} aria-hidden="true" /> Reprovar
          </button>
        </div>
      )}
    </li>
  );
}

function Fila({
  id,
  titulo,
  vazio,
  pedidos,
  onDecidir,
}: {
  id: string;
  titulo: string;
  vazio: string;
  pedidos: Pedido[];
  onDecidir: (id: string, d: Decisao) => Promise<void>;
}) {
  const tituloId = `${id}-titulo`;
  const pendente = pedidos.length > 0;
  return (
    <section
      id={id}
      aria-labelledby={tituloId}
      className="scroll-mt-32 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={tituloId} className="text-pretty text-lg font-bold text-slate-800">{titulo}</h2>
        <p className="text-sm text-slate-500">
          {pendente ? `${pedidos.length.toLocaleString("pt-BR")} aguardando` : "Nenhum item"}
        </p>
      </div>
      {pendente ? (
        <ul className="flex flex-col gap-3">
          {pedidos.map((p) => (
            <CartaoPedido key={p.id} pedido={p} onDecidir={(d) => onDecidir(p.id, d)} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">{vazio}</p>
      )}
    </section>
  );
}

function Atalho({ href, rotulo, total }: { href: string; rotulo: string; total: number }) {
  const pendente = total > 0;
  return (
    <a
      href={href}
      className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
    >
      <p className={`text-3xl font-bold tabular-nums ${pendente ? "text-slate-900" : "text-slate-400"}`}>{total.toLocaleString("pt-BR")}</p>
      <p className="mt-1 text-sm font-semibold text-slate-600">{rotulo}</p>
    </a>
  );
}

export default function AprovacoesAdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [vets, setVets] = useState<CrmvPendente[]>([]);
  const [clinicas, setClinicas] = useState<RtPendente[]>([]);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const rolouAteFila = useRef(false);

  const carregar = useCallback(async () => {
    try {
      const filas = await AprovacoesService.listar();
      setVets(filas.veterinarios);
      setClinicas(filas.clinicas);
    } catch {
      setAviso({ texto: "Não foi possível carregar as aprovações. Atualize a página.", erro: true });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push(urlDeLogin());
      return;
    }
    if (user.isAdmin) carregar();
    else setCarregando(false);
  }, [loading, user, router, carregar]);

  useEffect(() => {
    if (carregando || rolouAteFila.current) return;
    const id = window.location.hash.slice(1);
    rolouAteFila.current = true;
    if (id === "crmv" || id === "rt") document.getElementById(id)?.scrollIntoView();
  }, [carregando]);

  const atualizar = async () => {
    setCarregando(true);
    setAviso(null);
    await carregar();
  };

  const decidir = (tipo: "crmv" | "rt") => async (id: string, d: Decisao) => {
    try {
      const revisao = (tipo === "crmv" ? vets : clinicas).find((item) => item.id === id)?.revisao;
      if (!revisao) throw new Error("Atualize a lista antes de decidir.");
      const decisao = { ...d, revisao };
      await (tipo === "crmv" ? AprovacoesService.decidirCrmv(id, decisao) : AprovacoesService.decidirRt(id, decisao));
      setAviso({ texto: d.decisao === "aprovar" ? "Aprovado. O usuário foi avisado." : "Reprovado. O usuário foi avisado." });
      if (tipo === "crmv") setVets((atual) => atual.filter((v) => v.id !== id));
      else setClinicas((atual) => atual.filter((c) => c.id !== id));
    } catch {
      setAviso({ texto: "Não foi possível registrar a decisão. Atualize a lista e confira os dados novamente.", erro: true });
    }
  };

  if (loading || !user) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-28">
        <p role="status" className="text-sm text-slate-500">Carregando…</p>
      </main>
    );
  }

  if (!user.isAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-28">
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
          Esta área é restrita ao administrador da Lince Pet.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-16 pt-28">
      <AdminNav />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
            <ShieldCheck size={24} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-pretty text-2xl font-bold text-slate-800">Aprovações</h1>
            <p className="mt-1 max-w-xl text-sm text-pretty text-slate-500">
              Confira o número no conselho regional. Aprovar libera o perfil. Reprovar pede um motivo, que o usuário recebe.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={atualizar}
          disabled={carregando}
          className={`${BOTAO} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-orange-500`}
        >
          <RefreshCw size={16} aria-hidden="true" /> {carregando ? "Atualizando…" : "Atualizar"}
        </button>
      </header>

      {aviso && (
        <p role={aviso.erro ? "alert" : "status"} className={`rounded-lg px-4 py-3 text-sm ${aviso.erro ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>
          {aviso.texto}
        </p>
      )}

      {carregando && vets.length === 0 && clinicas.length === 0 ? (
        <p role="status" className="text-sm text-slate-500">Carregando…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Atalho href="#crmv" rotulo="CRMV em análise" total={vets.length} />
            <Atalho href="#rt" rotulo="Responsável técnico" total={clinicas.length} />
          </div>
          <Fila
            id="crmv"
            titulo="CRMV de veterinários"
            vazio="Nenhum CRMV aguardando análise."
            pedidos={vets.map(pedidoDoVet)}
            onDecidir={decidir("crmv")}
          />
          <Fila
            id="rt"
            titulo="RT de clínicas"
            vazio="Nenhum responsável técnico aguardando análise."
            pedidos={clinicas.map(pedidoDaClinica)}
            onDecidir={decidir("rt")}
          />
        </>
      )}
    </main>
  );
}
