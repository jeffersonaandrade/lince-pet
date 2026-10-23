"use client";

import { useState, type FormEvent } from "react";
import { mensagemDeErro } from "@/lib/erros";
import { ExamesClinicaService, formatarDuracao, formatarPreco, type Exame, type ExameInput } from "@/services/exames/exames";
import { botaoPerigo, botaoPrimario, botaoSecundario, Campo, campo, Mensagem, Secao } from "./ui";

const VAZIO: ExameInput = { nome: "", descricao: "", preparo: "", preco: 0, duracao_min: 30, capacidade: 1, ativo: true };

function FormExame({ inicial, onSalvar, onCancelar }: { inicial: ExameInput; onSalvar: (d: ExameInput) => Promise<void>; onCancelar?: () => void }) {
  const [dados, setDados] = useState<ExameInput>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const muda = <K extends keyof ExameInput>(k: K, v: ExameInput[K]) => setDados((d) => ({ ...d, [k]: v }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(dados);
      if (!onCancelar) setDados(VAZIO);
    } catch (error) {
      setErro(mensagemDeErro(error, "Confira os dados do exame."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
      <Campo rotulo="Nome do exame">
        <input className={campo} value={dados.nome} onChange={(e) => muda("nome", e.target.value)} required maxLength={150} />
      </Campo>
      <Campo rotulo="Preço (R$)">
        <input className={campo} type="number" min={0.01} step={0.01} value={dados.preco || ""} onChange={(e) => muda("preco", Number(e.target.value))} required />
      </Campo>
      <Campo rotulo="Duração (minutos)">
        <input className={campo} type="number" min={5} max={480} step={5} value={dados.duracao_min} onChange={(e) => muda("duracao_min", Number(e.target.value))} required />
      </Campo>
      <Campo rotulo="Vagas por horário" dica="Quantos pets fazem este exame ao mesmo tempo.">
        <input className={campo} type="number" min={1} max={50} value={dados.capacidade} onChange={(e) => muda("capacidade", Number(e.target.value))} required />
      </Campo>
      <Campo rotulo="Preparo" dica="Ex.: jejum de 8 horas. Vai nos lembretes do tutor.">
        <textarea className={campo} rows={2} maxLength={500} value={dados.preparo ?? ""} onChange={(e) => muda("preparo", e.target.value)} />
      </Campo>
      <Campo rotulo="Descrição">
        <textarea className={campo} rows={2} maxLength={500} value={dados.descricao ?? ""} onChange={(e) => muda("descricao", e.target.value)} />
      </Campo>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={dados.ativo !== false} onChange={(e) => muda("ativo", e.target.checked)} />
        Exame ativo
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        {onCancelar ? (
          <button type="button" className={botaoSecundario} onClick={onCancelar}>
            Cancelar
          </button>
        ) : null}
        <button type="submit" className={botaoPrimario} disabled={salvando}>
          {salvando ? "Salvando..." : onCancelar ? "Salvar exame" : "Adicionar exame"}
        </button>
      </div>
      <div className="sm:col-span-2">
        <Mensagem texto={erro} />
      </div>
    </form>
  );
}

const paraInput = (e: Exame): ExameInput => ({
  nome: e.nome,
  descricao: e.descricao ?? "",
  preparo: e.preparo ?? "",
  preco: e.preco,
  duracao_min: e.duracao_min,
  capacidade: e.capacidade,
  ativo: e.ativo,
});

export function CatalogoExames({ exames, onMudou }: { exames: Exame[]; onMudou: () => void }) {
  const [editando, setEditando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function remover(exame: Exame) {
    if (!window.confirm(`Remover o exame "${exame.nome}"?`)) return;
    try {
      const r = await ExamesClinicaService.removerExame(exame.id);
      setAviso(r.desativado ? "O exame tem agendamentos futuros: ele foi desativado em vez de removido." : null);
      onMudou();
    } catch (error) {
      setAviso(mensagemDeErro(error, "Não foi possível remover o exame."));
    }
  }

  return (
    <Secao titulo="Exames oferecidos" descricao="Preço, duração e vagas por horário de cada exame. O pagamento é feito na clínica.">
      <ul className="mb-4 flex flex-col gap-3">
        {exames.length === 0 ? <li className="text-sm text-slate-500">Nenhum exame cadastrado ainda.</li> : null}
        {exames.map((exame) =>
          editando === exame.id ? (
            <li key={exame.id}>
              <FormExame
                inicial={paraInput(exame)}
                onCancelar={() => setEditando(null)}
                onSalvar={async (d) => {
                  await ExamesClinicaService.atualizarExame(exame.id, d);
                  setEditando(null);
                  onMudou();
                }}
              />
            </li>
          ) : (
            <li key={exame.id} aria-label={exame.nome} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
              <div>
                <p className="font-semibold text-slate-800">
                  {exame.nome}
                  {!exame.ativo ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Inativo</span> : null}
                </p>
                <p className="text-sm text-slate-500">
                  {formatarPreco(exame.preco)} · {formatarDuracao(exame.duracao_min)} · {exame.capacidade} vaga(s) por horário
                </p>
                {exame.preparo ? <p className="mt-1 text-xs text-amber-700">Preparo: {exame.preparo}</p> : null}
              </div>
              <div className="flex gap-2">
                <button type="button" className={botaoSecundario} onClick={() => setEditando(exame.id)}>
                  Editar
                </button>
                <button type="button" className={botaoPerigo} onClick={() => remover(exame)}>
                  Remover
                </button>
              </div>
            </li>
          )
        )}
      </ul>
      <Mensagem texto={aviso} />
      <FormExame
        inicial={VAZIO}
        onSalvar={async (d) => {
          await ExamesClinicaService.criarExame(d);
          onMudou();
        }}
      />
    </Secao>
  );
}
