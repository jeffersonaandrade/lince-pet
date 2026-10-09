"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { fetchCep } from "@/services/external/brazilapi";
import { PrestadoresService, type Grade, type PerfilPrestador } from "@/services/prestadores/prestadores";
import { handleApiError } from "@/utils/errorHandler";
import { Alerta, Campo, DIAS_SEMANA, Entrada, botaoPrimario, botaoSecundario, inputClass } from "./ui";

type Props = { perfil: PerfilPrestador; onSalvo: () => void; textoBotao: string; onVoltar?: () => void };

function Rodape({ salvando, textoBotao, onVoltar }: { salvando: boolean; textoBotao: string; onVoltar?: () => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-3">
      {onVoltar ? (
        <button type="button" onClick={onVoltar} className={botaoSecundario}>
          Voltar
        </button>
      ) : null}
      <button type="submit" disabled={salvando} className={botaoPrimario}>
        {salvando ? "Salvando..." : textoBotao}
      </button>
    </div>
  );
}

/* --------------------------- endereço e atendimento -------------------------- */

export function FormEndereco({ perfil, onSalvo, textoBotao, onVoltar }: Props) {
  const e = perfil.endereco;
  const [form, setForm] = useState({
    cep: e.cep || "",
    rua: e.rua || "",
    numero: e.numero || "",
    bairro: e.bairro || "",
    cidade: e.cidade || "",
    estado: e.estado || "",
    raio_km: perfil.raio_km ? String(perfil.raio_km) : "",
  });
  const [domicilio, setDomicilio] = useState(perfil.atende_domicilio);
  const [localProprio, setLocalProprio] = useState(perfil.atende_local_proprio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alterar = (ev: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [ev.target.name]: ev.target.value }));

  const buscarCep = async () => {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const r = await fetchCep(cep);
      setForm((f) => ({
        ...f,
        rua: r.street || f.rua,
        bairro: r.neighborhood || f.bairro,
        cidade: r.city || f.cidade,
        estado: r.state || f.estado,
      }));
    } catch {
      setErro("CEP não encontrado. Preencha o endereço manualmente.");
    }
  };

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      await PrestadoresService.salvarEndereco({
        ...form,
        estado: form.estado.toUpperCase(),
        raio_km: domicilio && form.raio_km ? Number(form.raio_km) : null,
        atende_domicilio: domicilio,
        atende_local_proprio: localProprio,
      });
      onSalvo();
    } catch (err) {
      setErro(handleApiError(err).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      {erro ? <Alerta>{erro}</Alerta> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Campo label="CEP">
          <Entrada name="cep" value={form.cep} onChange={alterar} onBlur={buscarCep} inputMode="numeric" required />
        </Campo>
        <div className="sm:col-span-2">
          <Campo label="Rua">
            <Entrada name="rua" value={form.rua} onChange={alterar} required />
          </Campo>
        </div>
        <Campo label="Número">
          <Entrada name="numero" value={form.numero} onChange={alterar} required />
        </Campo>
        <Campo label="Bairro">
          <Entrada name="bairro" value={form.bairro} onChange={alterar} />
        </Campo>
        <Campo label="Cidade">
          <Entrada name="cidade" value={form.cidade} onChange={alterar} required />
        </Campo>
        <Campo label="UF">
          <Entrada name="estado" value={form.estado} onChange={alterar} maxLength={2} required />
        </Campo>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-slate-700">Onde você atende?</legend>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
          <input
            type="checkbox"
            className="h-4 w-4 accent-orange-500"
            checked={domicilio}
            onChange={(ev) => setDomicilio(ev.target.checked)}
          />
          <span className="text-sm text-slate-700">Na casa do tutor (domicílio)</span>
        </label>
        {domicilio ? (
          <div className="pl-7 sm:max-w-xs">
            <Campo label="Raio de atendimento (km)" dica="Opcional">
              <Entrada name="raio_km" type="number" min={1} max={200} value={form.raio_km} onChange={alterar} />
            </Campo>
          </div>
        ) : null}
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
          <input
            type="checkbox"
            className="h-4 w-4 accent-orange-500"
            checked={localProprio}
            onChange={(ev) => setLocalProprio(ev.target.checked)}
          />
          <span className="text-sm text-slate-700">No meu espaço (endereço acima)</span>
        </label>
      </fieldset>

      <Rodape salvando={salvando} textoBotao={textoBotao} onVoltar={onVoltar} />
    </form>
  );
}

/* --------------------------------- serviços --------------------------------- */

type LinhaServico = { nome: string; descricao: string; preco: string; duracao_min: string };

export function FormServicos({ perfil, onSalvo, textoBotao, onVoltar }: Props) {
  const porDiaria = perfil.tipo_servico.modalidade === "periodo";
  const [linhas, setLinhas] = useState<LinhaServico[]>(
    perfil.servicos.length
      ? perfil.servicos.map((s) => ({
          nome: s.nome,
          descricao: s.descricao || "",
          preco: String(s.preco),
          duracao_min: s.duracao_min ? String(s.duracao_min) : "",
        }))
      : [{ nome: "", descricao: "", preco: "", duracao_min: porDiaria ? "" : "60" }]
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alterar = (i: number, campo: keyof LinhaServico, valor: string) =>
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      await PrestadoresService.salvarServicos(
        linhas.map((l) => ({
          nome: l.nome,
          descricao: l.descricao || null,
          preco: Number(l.preco.replace(",", ".")),
          duracao_min: porDiaria ? null : Number(l.duracao_min),
        }))
      );
      onSalvo();
    } catch (err) {
      setErro(handleApiError(err).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      {erro ? <Alerta>{erro}</Alerta> : null}
      <Alerta tipo="info">
        {porDiaria
          ? "Seu serviço é cobrado por diária: o tutor escolhe entrada e saída e o valor é diária × dias."
          : "Informe a duração de cada serviço: o horário de fim do pedido é calculado a partir dela."}
      </Alerta>

      {linhas.map((l, i) => (
        <div key={i} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <Campo label="Serviço">
              <Entrada
                value={l.nome}
                onChange={(ev) => alterar(i, "nome", ev.target.value)}
                placeholder={porDiaria ? "Diária de hospedagem" : "Banho completo"}
                required
              />
            </Campo>
          </div>
          <div className={porDiaria ? "sm:col-span-3" : "sm:col-span-2"}>
            <Campo label={porDiaria ? "Preço da diária (R$)" : "Preço (R$)"}>
              <Entrada
                value={l.preco}
                onChange={(ev) => alterar(i, "preco", ev.target.value)}
                inputMode="decimal"
                required
              />
            </Campo>
          </div>
          {!porDiaria ? (
            <Campo label="Duração (min)">
              <Entrada
                type="number"
                min={15}
                max={720}
                step={15}
                value={l.duracao_min}
                onChange={(ev) => alterar(i, "duracao_min", ev.target.value)}
                required
              />
            </Campo>
          ) : null}
          <div className="sm:col-span-5">
            <Campo label="Descrição (opcional)">
              <Entrada value={l.descricao} onChange={(ev) => alterar(i, "descricao", ev.target.value)} />
            </Campo>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setLinhas((ls) => ls.filter((_, idx) => idx !== i))}
              disabled={linhas.length === 1}
              aria-label="Remover serviço"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          setLinhas((ls) => [...ls, { nome: "", descricao: "", preco: "", duracao_min: porDiaria ? "" : "60" }])
        }
        className={`${botaoSecundario} self-start`}
      >
        <Plus size={16} /> Adicionar serviço
      </button>

      <Rodape salvando={salvando} textoBotao={textoBotao} onVoltar={onVoltar} />
    </form>
  );
}

/* ------------------------- apresentação e horários -------------------------- */

export function FormApresentacao({ perfil, onSalvo, textoBotao, onVoltar }: Props) {
  const [bio, setBio] = useState(perfil.bio || "");
  const [grade, setGrade] = useState<Grade>(
    Object.keys(perfil.horarios || {}).length
      ? perfil.horarios
      : { "1": ["08:00", "18:00"], "2": ["08:00", "18:00"], "3": ["08:00", "18:00"], "4": ["08:00", "18:00"], "5": ["08:00", "18:00"] }
  );
  const [foto, setFoto] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alternarDia = (dia: string, ativo: boolean) =>
    setGrade((g) => {
      const nova = { ...g };
      if (ativo) nova[dia] = ["08:00", "18:00"];
      else delete nova[dia];
      return nova;
    });

  const alterarHora = (dia: string, posicao: 0 | 1, valor: string) =>
    setGrade((g) => {
      const faixa: [string, string] = [...g[dia]];
      faixa[posicao] = valor;
      return { ...g, [dia]: faixa };
    });

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      await PrestadoresService.salvarApresentacao({ bio, horarios: grade, foto });
      onSalvo();
    } catch (err) {
      setErro(handleApiError(err).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      {erro ? <Alerta>{erro}</Alerta> : null}
      <Campo label="Sobre você" dica="Conte sua experiência e como trabalha (mínimo de 20 caracteres).">
        <textarea
          value={bio}
          onChange={(ev) => setBio(ev.target.value)}
          rows={5}
          minLength={20}
          required
          className={inputClass}
        />
      </Campo>

      <Campo label="Foto de perfil" dica={perfil.foto_url ? "Envie uma nova para substituir a atual." : "JPG, PNG ou WEBP até 5 MB."}>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(ev) => setFoto(ev.target.files?.[0] || null)}
          className="text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-orange-700"
        />
      </Campo>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-slate-700">Dias e horários de atendimento</legend>
        {DIAS_SEMANA.map((nome, i) => {
          const dia = String(i);
          const faixa = grade[dia];
          return (
            <div key={dia} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <label className="flex w-32 items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-orange-500"
                  checked={!!faixa}
                  onChange={(ev) => alternarDia(dia, ev.target.checked)}
                />
                {nome}
              </label>
              {faixa ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <input
                    type="time"
                    value={faixa[0]}
                    onChange={(ev) => alterarHora(dia, 0, ev.target.value)}
                    className="rounded-lg border border-slate-200 px-2 py-1"
                    aria-label={`Abertura ${nome}`}
                  />
                  às
                  <input
                    type="time"
                    value={faixa[1]}
                    onChange={(ev) => alterarHora(dia, 1, ev.target.value)}
                    className="rounded-lg border border-slate-200 px-2 py-1"
                    aria-label={`Fechamento ${nome}`}
                  />
                </div>
              ) : (
                <span className="text-xs text-slate-400">Não atende</span>
              )}
            </div>
          );
        })}
      </fieldset>

      <Rodape salvando={salvando} textoBotao={textoBotao} onVoltar={onVoltar} />
    </form>
  );
}
