"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { urlDeLogin } from "@/lib/destino-login";
import { AprovacoesService, type CrmvPendente, type Decisao, type RtPendente } from "@/services/admin/aprovacoes";

type Pedido = { id: string; titulo: string; linhas: string[]; enviadoEm: string | null };

const dataCurta = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "-");

const pedidoDoVet = (v: CrmvPendente): Pedido => ({
  id: v.id,
  titulo: v.nome,
  linhas: [`CRMV ${v.crmv ?? "-"}${v.uf ? ` (${v.uf})` : ""}`, v.email ?? ""].filter(Boolean),
  enviadoEm: v.enviado_em,
});

const pedidoDaClinica = (c: RtPendente): Pedido => ({
  id: c.id,
  titulo: c.nome,
  linhas: [
    `RT: ${c.rt_nome ?? "-"} - CRMV ${c.rt_crmv ?? "-"}${c.uf ? ` (${c.uf})` : ""}`,
    [c.cidade, c.estado].filter(Boolean).join(" - "),
    c.cnpj ? `CNPJ ${c.cnpj}` : "",
  ].filter(Boolean),
  enviadoEm: c.enviado_em,
});

function CartaoPedido({ pedido, onDecidir }: { pedido: Pedido; onDecidir: (d: Decisao) => Promise<void> }) {
  const [reprovando, setReprovando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const decidir = async (d: Decisao) => {
    setEnviando(true);
    try {
      await onDecidir(d);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4" aria-label={pedido.titulo}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <strong className="text-slate-800">{pedido.titulo}</strong>
          {pedido.linhas.map((linha) => (
            <span key={linha} className="text-sm text-slate-500">
              {linha}
            </span>
          ))}
        </div>
        <span className="text-xs text-slate-400">Enviado em {dataCurta(pedido.enviadoEm)}</span>
      </div>
      {reprovando ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Motivo da reprovação
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={500}
              rows={2}
              className="rounded-lg border border-slate-300 p-2 text-sm font-normal"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={enviando || !motivo.trim()}
              onClick={() => decidir({ decisao: "reprovar", motivo: motivo.trim() })}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Confirmar reprovação
            </button>
            <button
              type="button"
              onClick={() => setReprovando(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={enviando}
            onClick={() => decidir({ decisao: "aprovar" })}
            className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Check size={16} /> Aprovar
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={() => setReprovando(true)}
            className="flex items-center gap-1 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <X size={16} /> Reprovar
          </button>
        </div>
      )}
    </li>
  );
}

function Fila({
  titulo,
  vazio,
  pedidos,
  onDecidir,
}: {
  titulo: string;
  vazio: string;
  pedidos: Pedido[];
  onDecidir: (id: string, d: Decisao) => Promise<void>;
}) {
  return (
    <section className="flex flex-col gap-3" aria-label={titulo}>
      <h2 className="text-lg font-bold text-slate-800">
        {titulo} <span className="text-sm font-normal text-slate-400">({pedidos.length})</span>
      </h2>
      {pedidos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">{vazio}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pedidos.map((p) => (
            <CartaoPedido key={p.id} pedido={p} onDecidir={(d) => onDecidir(p.id, d)} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AprovacoesAdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [vets, setVets] = useState<CrmvPendente[]>([]);
  const [clinicas, setClinicas] = useState<RtPendente[]>([]);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const filas = await AprovacoesService.listar();
      setVets(filas.veterinarios);
      setClinicas(filas.clinicas);
    } catch {
      setAviso({ texto: "Não foi possível carregar as aprovações.", erro: true });
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
  }, [loading, user, router, carregar]);

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

  if (loading || !user) return null;

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
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 pb-16 pt-28">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
          <ShieldCheck size={24} />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Aprovações</h1>
          <p className="text-sm text-slate-500">
            Confira o CRMV no conselho regional antes de aprovar. Reprovar exige motivo, que vai para o usuário.
          </p>
        </div>
      </header>

      {aviso && (
        <p
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${aviso.erro ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
        >
          {aviso.texto}
        </p>
      )}

      {carregando ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <>
          <Fila
            titulo="CRMV de veterinários"
            vazio="Nenhum CRMV aguardando análise."
            pedidos={vets.map(pedidoDoVet)}
            onDecidir={decidir("crmv")}
          />
          <Fila
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
