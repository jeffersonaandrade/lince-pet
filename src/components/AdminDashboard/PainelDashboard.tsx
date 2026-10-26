"use client";

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ContagemAgenda, PainelAdmin } from "@/lib/admin-dashboard";
import { buscarPainel } from "@/services/admin/dashboard";

const LARANJA = "#e67e22";
const ARDOSIA = "#334155";

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

const EIXO = { fill: "#64748b", fontSize: 12 };
const DICA = { borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 };

function mesPorExtenso(mes: string) {
  const data = new Date(`${mes}-01T12:00:00`);
  return data.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
}

function numero(valor: number) {
  return valor.toLocaleString("pt-BR");
}

function Cartao({ titulo, extra, children, className = "border-slate-200 bg-white" }: { titulo: string; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-800">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Grafico({ rotulo, altura = 224, children }: { rotulo: string; altura?: number; children: ReactElement }) {
  const [pronto, setPronto] = useState(false);
  useEffect(() => { setPronto(true); }, []);
  return (
    <div className="mt-4 w-full min-w-0" style={{ height: altura }} role="img" aria-label={rotulo}>
      {pronto ? <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer> : null}
    </div>
  );
}

function Fila({ href, rotulo, valor }: { href: string; rotulo: string; valor: number }) {
  const pendente = valor > 0;
  return (
    <Link
      href={href}
      className={pendente
        ? "rounded-xl border-2 border-orange-500 bg-orange-50 p-4 shadow-sm ring-2 ring-orange-200 hover:bg-orange-100"
        : "rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300"}
    >
      <p className={`text-3xl font-bold tabular-nums ${pendente ? "text-orange-700" : "text-slate-400"}`}>{numero(valor)}</p>
      <p className={`mt-1 text-sm font-semibold ${pendente ? "text-orange-900" : "text-slate-500"}`}>{rotulo}</p>
      {pendente ? <p className="mt-2 text-xs font-bold uppercase tracking-wide text-orange-700">Na fila</p> : null}
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
            <dd className="text-lg font-bold tabular-nums text-slate-900">{numero(contagem[chave])}</dd>
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

  const filasPendentes = dados
    ? dados.filas.crmv + dados.filas.responsavelTecnico + dados.filas.recuperacoesCnpj
    : 0;

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
          <Cartao
            titulo="Filas"
            className={filasPendentes > 0 ? "border-2 border-orange-400 bg-orange-50/70" : "border-slate-200 bg-white"}
            extra={filasPendentes > 0 ? (
              <p className="rounded-full bg-orange-600 px-3 py-1 text-xs font-bold text-white">
                {numero(filasPendentes)} aguardando
              </p>
            ) : (
              <p className="text-sm text-slate-500">Nenhum item aguardando.</p>
            )}
          >
            <p className="sr-only">
              {filasPendentes > 0 ? `${numero(filasPendentes)} itens aguardando na fila.` : "Nenhum item na fila."}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Fila href="/admin/aprovacoes#crmv" rotulo="CRMV em análise" valor={dados.filas.crmv} />
              <Fila href="/admin/aprovacoes#rt" rotulo="Responsável técnico" valor={dados.filas.responsavelTecnico} />
              <Fila href="/admin/recuperacoes" rotulo="Recuperação de CNPJ" valor={dados.filas.recuperacoesCnpj} />
            </div>
          </Cartao>
          <Cartao titulo="Contas ativas">
            <Grafico rotulo={`Contas ativas: ${CONTAS.map(([chave, nome]) => `${numero(dados.contas[chave])} ${nome.toLowerCase()}`).join(", ")}.`} altura={220}>
              <BarChart data={CONTAS.map(([chave, rotulo]) => ({ rotulo, quantidade: dados.contas[chave] }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} interval={0} />
                <YAxis allowDecimals={false} tick={EIXO} axisLine={false} tickLine={false} width={32} />
                <Tooltip cursor={{ fill: "#fff7ed" }} contentStyle={DICA} />
                <Bar dataKey="quantidade" name="Ativas" fill={LARANJA} radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </Grafico>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CONTAS.map(([chave, rotulo]) => (
                <div key={chave} className="rounded-xl bg-slate-50 px-3 py-3">
                  <dt className="text-xs text-slate-500">{rotulo}</dt>
                  <dd className="text-2xl font-bold tabular-nums text-slate-900">{numero(dados.contas[chave])}</dd>
                </div>
              ))}
            </dl>
          </Cartao>
          <Cartao titulo="Agenda do mês">
            <Grafico
              rotulo="Consultas e pedidos do mês por status."
              altura={260}
            >
              <BarChart
                layout="vertical"
                data={STATUS.map(([chave, rotulo]) => ({
                  rotulo,
                  consultas: dados.agenda.consultas[chave],
                  pedidos: dados.agenda.pedidos[chave],
                }))}
                margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
              >
                <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={EIXO} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="rotulo" tick={{ ...EIXO, width: 120 }} axisLine={false} tickLine={false} width={128} />
                <Tooltip cursor={{ fill: "#fff7ed" }} contentStyle={DICA} />
                <Legend />
                <Bar dataKey="consultas" name="Consultas" fill={LARANJA} radius={[0, 4, 4, 0]} maxBarSize={14} />
                <Bar dataKey="pedidos" name="Pedidos" fill={ARDOSIA} radius={[0, 4, 4, 0]} maxBarSize={14} />
              </BarChart>
            </Grafico>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <ListaStatus titulo="Consultas" contagem={dados.agenda.consultas} />
              <ListaStatus titulo="Pedidos" contagem={dados.agenda.pedidos} />
            </div>
          </Cartao>
          <Cartao titulo="Assinaturas ativas">
            <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">{numero(dados.assinaturas.total)}</p>
            {dados.assinaturas.porPlano.length > 0 ? (
              <>
                <Grafico
                  rotulo={`Assinaturas ativas por plano: ${dados.assinaturas.porPlano.map((plano) => `${plano.codigo} ${numero(plano.quantidade)}`).join(", ")}.`}
                  altura={Math.max(160, dados.assinaturas.porPlano.length * 44)}
                >
                  <BarChart
                    layout="vertical"
                    data={dados.assinaturas.porPlano}
                    margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={EIXO} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="codigo" tick={EIXO} axisLine={false} tickLine={false} width={120} />
                    <Tooltip cursor={{ fill: "#fff7ed" }} contentStyle={DICA} />
                    <Bar dataKey="quantidade" name="Ativas" fill={LARANJA} radius={[0, 6, 6, 0]} maxBarSize={18} />
                  </BarChart>
                </Grafico>
                <ul className="mt-3 divide-y divide-slate-100">
                  {dados.assinaturas.porPlano.map((plano) => (
                    <li key={plano.codigo} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-600">{plano.codigo}</span>
                      <span className="font-semibold tabular-nums text-slate-900">{numero(plano.quantidade)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : <p className="mt-2 text-sm text-slate-500">Nenhuma assinatura ativa.</p>}
          </Cartao>
          <Link href="/admin/uso" className="text-sm font-semibold text-orange-700 hover:underline">Uso de dados</Link>
        </>
      )}
    </div>
  );
}
