"use client";

import { useState, type FormEvent } from "react";
import { mensagemDeErro } from "@/lib/erros";
import { ExamesClinicaService, formatarPreco, type Combo, type ComboInput, type Exame } from "@/services/exames/exames";
import { botaoPerigo, botaoPrimario, botaoSecundario, Campo, campo, Mensagem, Secao } from "./ui";

const VAZIO: ComboInput = { nome: "", descricao: "", preco: 0, exame_ids: [], ativo: true };

function FormCombo({
  exames,
  inicial,
  onSalvar,
  onCancelar,
}: {
  exames: Exame[];
  inicial: ComboInput;
  onSalvar: (d: ComboInput) => Promise<void>;
  onCancelar?: () => void;
}) {
  const [dados, setDados] = useState<ComboInput>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const selecionados = new Set(dados.exame_ids);
  const avulso = exames.filter((e) => selecionados.has(e.id)).reduce((s, e) => s + e.preco, 0);

  function alternar(id: string) {
    setDados((d) => ({
      ...d,
      exame_ids: d.exame_ids.includes(id) ? d.exame_ids.filter((x) => x !== id) : [...d.exame_ids, id],
    }));
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (dados.exame_ids.length < 2) {
      setErro("Escolha pelo menos 2 exames para o combo.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(dados);
      if (!onCancelar) setDados(VAZIO);
    } catch (error) {
      setErro(mensagemDeErro(error, "Confira os dados do combo."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
      <Campo rotulo="Nome do combo">
        <input className={campo} value={dados.nome} onChange={(e) => setDados((d) => ({ ...d, nome: e.target.value }))} required maxLength={150} />
      </Campo>
      <Campo rotulo="Preço do combo (R$)" dica={avulso ? `Avulso sairia ${formatarPreco(avulso)}` : undefined}>
        <input
          className={campo}
          type="number"
          min={0.01}
          step={0.01}
          value={dados.preco || ""}
          onChange={(e) => setDados((d) => ({ ...d, preco: Number(e.target.value) }))}
          required
        />
      </Campo>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-medium text-slate-700">Exames do combo</legend>
        <div className="flex flex-wrap gap-2">
          {exames.filter((e) => e.ativo).map((exame) => (
            <label key={exame.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
              <input type="checkbox" checked={selecionados.has(exame.id)} onChange={() => alternar(exame.id)} />
              {exame.nome}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2 sm:col-span-2">
        {onCancelar ? (
          <button type="button" className={botaoSecundario} onClick={onCancelar}>
            Cancelar
          </button>
        ) : null}
        <button type="submit" className={botaoPrimario} disabled={salvando}>
          {salvando ? "Salvando..." : onCancelar ? "Salvar combo" : "Criar combo"}
        </button>
      </div>
      <div className="sm:col-span-2">
        <Mensagem texto={erro} />
      </div>
    </form>
  );
}

export function CombosExames({ exames, combos, onMudou }: { exames: Exame[]; combos: Combo[]; onMudou: () => void }) {
  const [editando, setEditando] = useState<string | null>(null);
  const ativos = exames.filter((e) => e.ativo).length;

  async function remover(combo: Combo) {
    if (!window.confirm(`Remover o combo "${combo.nome}"?`)) return;
    await ExamesClinicaService.removerCombo(combo.id);
    onMudou();
  }

  return (
    <Secao titulo="Combos" descricao="Pacote com 2 ou mais exames por um preço único.">
      <ul className="mb-4 flex flex-col gap-3">
        {combos.length === 0 ? <li className="text-sm text-slate-500">Nenhum combo cadastrado.</li> : null}
        {combos.map((combo) =>
          editando === combo.id ? (
            <li key={combo.id}>
              <FormCombo
                exames={exames}
                inicial={{ nome: combo.nome, descricao: combo.descricao, preco: combo.preco, exame_ids: combo.exames.map((e) => e.id), ativo: combo.ativo }}
                onCancelar={() => setEditando(null)}
                onSalvar={async (d) => {
                  await ExamesClinicaService.atualizarCombo(combo.id, d);
                  setEditando(null);
                  onMudou();
                }}
              />
            </li>
          ) : (
            <li key={combo.id} aria-label={combo.nome} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
              <div>
                <p className="font-semibold text-slate-800">
                  {combo.nome}
                  {!combo.disponivel ? (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Indisponível</span>
                  ) : null}
                </p>
                <p className="text-sm text-slate-500">
                  {combo.exames.map((e) => e.nome).join(" + ")} · {formatarPreco(combo.preco)}
                  {combo.preco_avulso > combo.preco ? <span className="ml-1 text-slate-400 line-through">{formatarPreco(combo.preco_avulso)}</span> : null}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className={botaoSecundario} onClick={() => setEditando(combo.id)}>
                  Editar
                </button>
                <button type="button" className={botaoPerigo} onClick={() => remover(combo)}>
                  Remover
                </button>
              </div>
            </li>
          )
        )}
      </ul>
      {ativos >= 2 ? (
        <FormCombo
          exames={exames}
          inicial={VAZIO}
          onSalvar={async (d) => {
            await ExamesClinicaService.criarCombo(d);
            onMudou();
          }}
        />
      ) : (
        <p className="text-sm text-slate-500">Cadastre pelo menos 2 exames ativos para montar um combo.</p>
      )}
    </Secao>
  );
}
