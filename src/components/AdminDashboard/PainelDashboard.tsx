"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import type { ContagemAgenda, PainelAdmin } from "@/lib/admin-dashboard";
import { buscarPainel } from "@/services/admin/dashboard";

const CONTAS = [
  ["tutor", "Tutores"],
  ["veterinario", "Veterinários"],
  ["clinica", "Clínicas"],
  ["prestador", "Prestadores"],
] as const;

const STATUS = [
  ["pendente", "Aguardando"],
  ["confirmado", "Confirmado"],
  ["emAndamento", "Em andamento"],
  ["realizado", "Concluído"],
  ["cancelado", "Cancelado"],
] as const;

function mesPorExtenso(mes: string) {
  const data = new Date(`${mes}-01T12:00:00`);
  return data.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
}

function Cartao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-slate-800">{titulo}</h2>
      {children}
    </section>
  );
}

function Fila({ href, rotulo, valor }: { href: string; rotulo: string; valor: number }) {
  return (
    <Link href={href} className="rounded-xl border border-slate-200 p-4 hover:border-orange-300">
      <p className="text-3xl font-bold tabular-nums text-slate-900">{valor.toLocaleString("pt-BR")}</p>
      <p className="mt-1 text-sm font-semibold text-orange-700">{rotulo}</p>
    </Link>
  );
}

function ListaStatus({ titulo, contagem }: { titulo: string; contagem: ContagemAgenda }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700">{titulo}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        {STATUS.map(([chave, rotulo]) => (
          <div key={chave} className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-xs text-slate-500">{rotulo}</dt>
            <dd className="text-lg font-bold tabular-nums text-slate-900">{contagem[chave].toLocaleString("pt-BR")}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function PainelDashboard() {
  const [dados, setDados] = useState<PainelAdmin | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    buscarPainel()
      .then((resultado) => { if (ativo) setDados(resultado); })
      .catch(() => { if (ativo) setErro(true); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const atualizar = async () => {
    setCarregando(true);
    setErro(false);
    try { setDados(await buscarPainel()); }
    catch { setErro(true); }
    finally { setCarregando(false); }
  };

  return (
    <div className="flex flex-col gap-6" aria-busy={carregando}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {dados ? `Mês de ${mesPorExtenso(dados.mes)}.` : "Aguardando a leitura."}
        </p>
        <button type="button" onClick={atualizar} disabled={carregando}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={16} aria-hidden="true" /> {carregando ? "Consultando..." : "Atualizar"}
        </button>
      </div>
      {erro && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">Não foi possível carregar o painel. Tente novamente.</p>}
      {!dados && carregando && <p role="status" className="text-sm text-slate-500">Consultando as métricas...</p>}
      {dados && (
        <>
          <Cartao titulo="Filas">
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Fila href="/admin/aprovacoes" rotulo="CRMV em análise" valor={dados.filas.crmv} />
              <Fila href="/admin/aprovacoes" rotulo="Responsável técnico" valor={dados.filas.responsavelTecnico} />
              <Fila href="/admin/recuperacoes" rotulo="Recuperação de CNPJ" valor={dados.filas.recuperacoesCnpj} />
            </div>
          </Cartao>
          <Cartao titulo="Contas ativas">
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CONTAS.map(([chave, rotulo]) => (
                <div key={chave} className="rounded-xl bg-slate-50 px-3 py-3">
                  <dt className="text-xs text-slate-500">{rotulo}</dt>
                  <dd className="text-2xl font-bold tabular-nums text-slate-900">{dados.contas[chave].toLocaleString("pt-BR")}</dd>
                </div>
              ))}
            </dl>
          </Cartao>
          <Cartao titulo="Agenda do mês">
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <ListaStatus titulo="Consultas" contagem={dados.agenda.consultas} />
              <ListaStatus titulo="Pedidos" contagem={dados.agenda.pedidos} />
            </div>
          </Cartao>
          <Cartao titulo="Assinaturas ativas">
            <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">{dados.assinaturas.total.toLocaleString("pt-BR")}</p>
            {dados.assinaturas.porPlano.length > 0 ? (
              <ul className="mt-3 divide-y divide-slate-100">
                {dados.assinaturas.porPlano.map((plano) => (
                  <li key={plano.codigo} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-600">{plano.codigo}</span>
                    <span className="font-semibold tabular-nums text-slate-900">{plano.quantidade.toLocaleString("pt-BR")}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-slate-500">Nenhuma assinatura ativa.</p>}
          </Cartao>
          <Link href="/admin/uso" className="text-sm font-semibold text-orange-700 hover:underline">Uso de dados</Link>
        </>
      )}
    </div>
  );
}
