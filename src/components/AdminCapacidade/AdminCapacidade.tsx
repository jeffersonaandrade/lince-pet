"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { formatarBytes, type CapacidadeAdmin, type MedicaoCapacidade } from "@/lib/capacidade";
import { buscarCapacidade } from "@/services/admin/capacidade";

const niveis = {
  normal: { titulo: "Dentro da referência", cor: "bg-emerald-500", texto: "text-emerald-800 bg-emerald-50" },
  atencao: { titulo: "Atenção: planeje a ampliação", cor: "bg-amber-500", texto: "text-amber-900 bg-amber-50" },
  critico: { titulo: "Crítico: priorize a ampliação", cor: "bg-red-600", texto: "text-red-800 bg-red-50" },
  excedido: { titulo: "Referência de capacidade atingida", cor: "bg-red-600", texto: "text-red-800 bg-red-50" },
};

function Medidor({ titulo, uso, indisponivel, parcial = false }: {
  titulo: string; uso: MedicaoCapacidade | null; indisponivel: string; parcial?: boolean;
}) {
  const nivel = uso ? niveis[parcial && uso.nivel === "normal" ? "atencao" : uso.nivel] : null;
  return (
    <section aria-label={titulo} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-slate-800">{titulo}</h2>
      {uso && nivel ? (
        <>
          <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
            {uso.percentual.toLocaleString("pt-BR")}% <span className="text-sm font-normal text-slate-500">da referência</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">{formatarBytes(uso.bytes)} de {formatarBytes(uso.limiteBytes)}</p>
          <div role="meter" aria-label={titulo} aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.min(100, uso.percentual)} aria-valuetext={`${uso.percentual}% da referência`}
            className="my-4 h-3 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${nivel.cor}`} style={{ width: `${Math.min(100, uso.percentual)}%` }} />
          </div>
          <p className={`rounded-lg px-3 py-2 text-sm font-semibold ${nivel.texto}`}>
            {parcial ? "Leitura parcial: o uso real pode ser maior" : nivel.titulo}
          </p>
          <p className="mt-2 text-xs text-slate-500">Folga na referência: {formatarBytes(uso.livresBytes)}.</p>
        </>
      ) : <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{indisponivel}</p>}
    </section>
  );
}

export default function PainelCapacidade() {
  const [dados, setDados] = useState<CapacidadeAdmin | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    buscarCapacidade().then((resultado) => { if (ativo) setDados(resultado); })
      .catch(() => { if (ativo) setErro(true); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const atualizar = async () => {
    setCarregando(true);
    setErro(false);
    try { setDados(await buscarCapacidade()); }
    catch { setErro(true); }
    finally { setCarregando(false); }
  };

  return (
    <div className="flex flex-col gap-6" aria-busy={carregando}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {dados ? `Leitura de ${new Date(dados.consultadoEm).toLocaleString("pt-BR")}.` : "Aguardando a primeira leitura."}
          {" "}Atualização das métricas em até 1 minuto.
        </p>
        <button type="button" onClick={atualizar} disabled={carregando}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={16} aria-hidden="true" /> {carregando ? "Consultando..." : "Atualizar leitura"}
        </button>
      </div>
      {erro && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">Não foi possível atualizar o uso de dados. Tente novamente. {dados && "Os valores abaixo são da última leitura disponível."}</p>}
      {!dados && carregando && <p role="status" className="text-sm text-slate-500">Consultando banco e arquivos...</p>}
      {dados && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Medidor titulo="Banco de dados" uso={dados.banco.uso} indisponivel="Medição indisponível. Não é possível avaliar a folga do banco agora." />
            <Medidor titulo="Arquivos no Storage" uso={dados.storage.uso} parcial={dados.storage.status === "parcial"}
              indisponivel={dados.storage.status === "nao_configurado" ? "Storage do Supabase não encontrado neste banco. O uso de arquivos não foi medido." : "Medição de arquivos indisponível. Não considere o armazenamento vazio."} />
          </div>
          <aside className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm leading-6 text-orange-950">
            <p className="font-semibold">Prepare a próxima etapa antes de atingir a capacidade.</p>
            <p>Alertas em 70% e 90%. Compare o custo do plano pago com uma migração planejada, incluindo backup, restauração e arquivos. Evite esperar o serviço apresentar restrições.</p>
            <p className="mt-2">Sem histórico de crescimento, esta tela não estima quantos dias faltam para atingir a referência.</p>
          </aside>
          <section aria-label="Maiores tabelas" className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold text-slate-800">O que ocupa o banco</h2>
            <p className="mt-1 text-sm text-slate-500">Até 15 maiores tabelas, incluindo índices. Registros são estimativas do PostgreSQL, não contagens exatas.</p>
            {dados.banco.status === "indisponivel" ? <p className="mt-3 text-sm text-amber-800">Tabelas indisponíveis nesta leitura.</p> : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-slate-200 text-slate-500"><th scope="col" className="py-2 pr-4">Tabela</th><th scope="col" className="py-2 pr-4 text-right">Registros estimados</th><th scope="col" className="py-2 text-right">Espaço</th></tr></thead>
                  <tbody>{dados.banco.tabelas.map((t) => <tr key={`${t.schema}.${t.nome}`} className="border-b border-slate-100"><th scope="row" className="py-3 pr-4 font-medium text-slate-700">{t.schema}.{t.nome}</th><td className="py-3 pr-4 text-right tabular-nums">{t.registrosEstimados.toLocaleString("pt-BR")}</td><td className="py-3 text-right tabular-nums">{formatarBytes(t.bytes)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
          {dados.storage.uso && <section aria-label="Arquivos por bucket" className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold text-slate-800">Fotos, laudos e outros arquivos</h2>
            <p className="mt-1 text-sm text-slate-500">{dados.storage.objetos.toLocaleString("pt-BR")} arquivos registrados no projeto.</p>
            {dados.storage.semTamanho > 0 && <p role="status" className="mt-2 text-sm text-amber-800">{dados.storage.semTamanho} arquivos sem tamanho conhecido não entram no total de bytes.</p>}
            <ul className="mt-3 divide-y divide-slate-100">{dados.storage.buckets.map((b) => <li key={b.nome} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="font-medium text-slate-700">{b.nome}</span><span className="text-slate-500">{b.objetos.toLocaleString("pt-BR")} arquivos · {formatarBytes(b.bytes)}</span></li>)}</ul>
            {dados.storage.objetos === 0 && <p className="mt-3 text-sm text-slate-500">Nenhum arquivo registrado no Storage deste projeto.</p>}
          </section>}
          <section aria-label="Limites desta medição" className="text-sm leading-6 text-slate-500">
            <p>Referência configurada: {dados.referencia.bancoMb} MB para banco e {dados.referencia.storageGb} GB para arquivos. {dados.referencia.bancoMb === 500 && dados.referencia.storageGb === 1 ? "Padrão de referência: Supabase Free." : "Limites ajustados para este ambiente."} A leitura não confirma o plano contratado. MB e GB usam unidades decimais.</p>
            <p className="mt-2">O banco medido inclui todos os seus schemas, inclusive serviços que compartilhem esta conexão. Arquivos são estimados pelos metadados do Storage. A cobrança considera o período e pode incluir outros projetos da organização.</p>
            <p className="mt-2">Transferência mensal, WAL, CPU e conexões não são medidos aqui. A quantidade de cadastros não garante que o plano ainda comporte a aplicação.</p>
            <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-orange-700 underline">Conferir consumo oficial no Supabase</a>
          </section>
        </>
      )}
    </div>
  );
}
