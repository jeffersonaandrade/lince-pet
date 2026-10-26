"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CalendarCheck, FlaskConical, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { urlDeLogin, urlDePerfis } from "@/lib/destino-login";
import { mensagemDeErro } from "@/lib/erros";
import { ANCORA_CONSULTAS } from "@/lib/agenda-tutor";
import { PetsService, type PetRecord } from "@/services/pets/pets";
import {
  ExamesService,
  formatarDuracao,
  formatarPreco,
  type AgendamentoExame,
  type Disponibilidade,
  type Escolha,
  type OfertaExames,
} from "@/services/exames/exames";
import { botaoPrimario, campo, Mensagem, Secao } from "@/components/Exames/ui";

const hojeIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

function AgendarExame() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const encaminhamentoId = searchParams.get("encaminhamento");
  const { user, loading } = useAuth();

  const [oferta, setOferta] = useState<OfertaExames | null | undefined>(undefined);
  const [comboId, setComboId] = useState<string | null>(null);
  const [exameIds, setExameIds] = useState<string[]>([]);
  const [data, setData] = useState("");
  const [disp, setDisp] = useState<Disponibilidade | null>(null);
  const [horario, setHorario] = useState("");
  const [pets, setPets] = useState<PetRecord[]>([]);
  const [petId, setPetId] = useState(searchParams.get("pet") ?? "");
  const [observacoes, setObservacoes] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [agendado, setAgendado] = useState<AgendamentoExame | null>(null);

  const escolha: Escolha = useMemo(() => (comboId ? { combo_id: comboId } : { exame_ids: exameIds }), [comboId, exameIds]);
  const temEscolha = Boolean(comboId) || exameIds.length > 0;
  const ehTutor = user?.userType === "tutor";

  useEffect(() => {
    ExamesService.daClinica(id)
      .then(setOferta)
      .catch(() => setOferta(null));
  }, [id]);

  useEffect(() => {
    if (!ehTutor) return;
    PetsService.listarPets()
      .then((lista) => {
        setPets(lista);
        setPetId((atual) => atual || (lista.length === 1 ? lista[0].id : ""));
      })
      .catch(() => setPets([]));
  }, [ehTutor]);

  useEffect(() => {
    setHorario("");
    setDisp(null);
    if (!temEscolha || !data) return;
    let cancelado = false;
    ExamesService.disponibilidade(id, escolha, data)
      .then((d) => !cancelado && setDisp(d))
      .catch((error) => !cancelado && setErro(mensagemDeErro(error, "Não foi possível carregar os horários.")));
    return () => {
      cancelado = true;
    };
  }, [id, escolha, data, temEscolha]);

  function alternarExame(exameId: string) {
    setComboId(null);
    setExameIds((ids) => (ids.includes(exameId) ? ids.filter((x) => x !== exameId) : [...ids, exameId]));
  }

  async function agendar() {
    setEnviando(true);
    setErro(null);
    try {
      setAgendado(
        await ExamesService.agendar(id, {
          ...escolha,
          pet_id: petId,
          data,
          horario,
          observacoes: observacoes || undefined,
          encaminhamento_id: encaminhamentoId,
        })
      );
    } catch (error) {
      setErro(mensagemDeErro(error, "Não foi possível agendar o exame."));
      if (data) ExamesService.disponibilidade(id, escolha, data).then(setDisp).catch(() => undefined);
    } finally {
      setEnviando(false);
    }
  }

  if (oferta === undefined) return <p className="px-4 py-10 text-center text-slate-500">Carregando...</p>;
  if (oferta === null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 text-center">
        <p className="text-slate-600">Esta clínica não está oferecendo exames no momento.</p>
        <Link href="/explorar?tab=exames" className="mt-4 inline-block text-orange-600 hover:underline">
          Ver outras clínicas
        </Link>
      </main>
    );
  }

  const { clinica, exames, combos } = oferta;

  if (agendado) {
    const preparos = agendado.exames.filter((e) => e.preparo);
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <Secao titulo="Exame agendado!" rotulo="Exame agendado">
          <div className="flex items-start gap-3">
            <CalendarCheck className="mt-1 text-emerald-600" />
            <div className="text-sm text-slate-700">
              <p>
                {agendado.exames.map((e) => e.nome).join(", ")} para {agendado.pet?.nome} em {clinica.nome}.
              </p>
              <p className="mt-1">
                {agendado.data?.split("-").reverse().join("/")} às {agendado.horario} · {formatarPreco(agendado.preco)} (pagamento na clínica)
              </p>
              {preparos.length ? (
                <div className="mt-3 rounded-lg bg-amber-50 p-3 text-amber-900">
                  <strong>Preparo:</strong>
                  <ul className="mt-1 list-disc pl-5">
                    {preparos.map((e) => (
                      <li key={e.nome}>
                        {e.nome}: {e.preparo}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
          <Link href={`/dashboard/tutor#${ANCORA_CONSULTAS}`} className={`${botaoPrimario} mt-5 inline-block`}>
            Ver minhas consultas
          </Link>
        </Secao>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <header>
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-orange-600">
          <FlaskConical size={16} /> Exames
        </p>
        <h1 className="text-2xl font-bold text-slate-800">{clinica.nome}</h1>
        <p className="flex items-center gap-1 text-sm text-slate-500">
          <MapPin size={14} /> {[clinica.endereco, clinica.cidade, clinica.estado].filter(Boolean).join(" - ")}
        </p>
        <p className="mt-1 text-sm text-slate-500">Agendamento confirmado na hora. O pagamento é feito na clínica.</p>
        {encaminhamentoId ? <p className="mt-2 text-sm font-medium text-emerald-700">Agendamento pelo encaminhamento do seu veterinário.</p> : null}
      </header>

      <Secao titulo="1. Escolha os exames" rotulo="Escolha os exames">
        {combos.length ? (
          <fieldset className="mb-4">
            <legend className="mb-2 text-sm font-semibold text-slate-700">Combos</legend>
            <div className="flex flex-col gap-2">
              {combos.map((c) => (
                <label key={c.id} className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3 ${comboId === c.id ? "border-orange-400 bg-orange-50" : "border-slate-200"}`}>
                  <span className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="combo"
                      className="mt-1"
                      checked={comboId === c.id}
                      onChange={() => {
                        setComboId(c.id);
                        setExameIds([]);
                      }}
                    />
                    <span>
                      <span className="font-semibold text-slate-800">{c.nome}</span>
                      <span className="block text-xs text-slate-500">
                        {c.exames.map((e) => e.nome).join(" + ")} · {formatarDuracao(c.duracao_min)}
                      </span>
                    </span>
                  </span>
                  <span className="text-right text-sm font-semibold text-slate-800">
                    {formatarPreco(c.preco)}
                    {c.preco_avulso > c.preco ? <span className="block text-xs font-normal text-slate-400 line-through">{formatarPreco(c.preco_avulso)}</span> : null}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-700">Exames avulsos</legend>
          <div className="flex flex-col gap-2">
            {exames.map((e) => (
              <label key={e.id} className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3 ${exameIds.includes(e.id) ? "border-orange-400 bg-orange-50" : "border-slate-200"}`}>
                <span className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={exameIds.includes(e.id)} onChange={() => alternarExame(e.id)} />
                  <span>
                    <span className="font-semibold text-slate-800">{e.nome}</span>
                    <span className="block text-xs text-slate-500">
                      {formatarDuracao(e.duracao_min)}
                      {e.descricao ? ` · ${e.descricao}` : ""}
                    </span>
                    {e.preparo ? <span className="block text-xs text-amber-700">Preparo: {e.preparo}</span> : null}
                  </span>
                </span>
                <span className="text-sm font-semibold text-slate-800">{formatarPreco(e.preco)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Secao>

      <Secao titulo="2. Data e horário" rotulo="Data e horário">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:w-60">
          Data do exame
          <input type="date" className={campo} min={hojeIso()} value={data} disabled={!temEscolha} onChange={(e) => setData(e.target.value)} />
        </label>
        {!temEscolha ? <p className="mt-2 text-sm text-slate-500">Escolha os exames para ver os horários.</p> : null}
        {disp ? (
          disp.horarios.length ? (
            <div className="mt-4">
              <p className="mb-2 text-sm text-slate-500">
                Duração: {formatarDuracao(disp.duracao_min)} · Total: {formatarPreco(disp.preco)}
              </p>
              <div role="radiogroup" aria-label="Horários disponíveis" className="flex flex-wrap gap-2">
                {disp.horarios.map((h) => (
                  <button
                    key={h}
                    type="button"
                    role="radio"
                    aria-checked={horario === h}
                    onClick={() => setHorario(h)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${horario === h ? "border-orange-500 bg-orange-500 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-orange-300"}`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Sem horários livres nesta data. Tente outro dia.</p>
          )
        ) : null}
      </Secao>

      <Secao titulo="3. Confirmar" rotulo="Confirmar agendamento">
        {loading ? null : !user ? (
          <Link href={urlDeLogin()} className={botaoPrimario}>
            Entrar para agendar
          </Link>
        ) : !ehTutor ? (
          <Link href={urlDePerfis()} className={botaoPrimario}>Trocar para o perfil de tutor</Link>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:w-72">
              Pet
              <select className={campo} value={petId} onChange={(e) => setPetId(e.target.value)}>
                <option value="">Selecione o pet</option>
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Observações para a clínica (opcional)
              <textarea className={campo} rows={2} maxLength={255} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </label>
            <button type="button" className={`${botaoPrimario} self-start`} disabled={enviando || !horario || !petId} onClick={agendar}>
              {enviando ? "Agendando..." : "Confirmar agendamento"}
            </button>
          </div>
        )}
        <Mensagem texto={erro} />
      </Secao>
    </main>
  );
}

export default function AgendarExamePage() {
  return (
    <Suspense fallback={null}>
      <AgendarExame />
    </Suspense>
  );
}
