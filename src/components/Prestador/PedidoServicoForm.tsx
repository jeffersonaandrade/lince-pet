"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import MinhaAgendaDoDia from "@/components/Encaminhamento/MinhaAgendaDoDia";
import { PetsService, type PetRecord } from "@/services/pets/pets";
import { PrestadoresService, type PrestadorPublico } from "@/services/prestadores/prestadores";
import { handleApiError } from "@/utils/errorHandler";
import { Alerta, Campo, Entrada, botaoPrimario, formatarDuracao, formatarPreco, inputClass } from "./ui";

const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

function diarias(data: string, hora: string, dataFim: string, horaFim: string) {
  if (!data || !dataFim) return 0;
  const ms = new Date(`${dataFim}T${horaFim || hora || "00:00"}`).getTime() - new Date(`${data}T${hora || "00:00"}`).getTime();
  return ms > 0 ? Math.max(1, Math.ceil(ms / 86_400_000 - 1e-9)) : 0;
}

/** Formulário "Pedir serviço" do perfil público: sessão (duração) ou hospedagem (entrada e saída). */
export default function PedidoServicoForm({
  prestador,
  encaminhamentoId,
  petIdInicial,
}: {
  prestador: PrestadorPublico;
  encaminhamentoId?: string | null;
  petIdInicial?: string | null;
}) {
  const { user } = useAuth();
  const porDiaria = prestador.tipo_servico.modalidade === "periodo";
  const [pets, setPets] = useState<PetRecord[]>([]);
  const [servicoId, setServicoId] = useState(prestador.servicos[0]?.id || "");
  const [petId, setPetId] = useState("");
  const [local, setLocal] = useState<"domicilio" | "local_proprio">(
    prestador.atende_domicilio ? "domicilio" : "local_proprio"
  );
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [horarioFim, setHorarioFim] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const ehTutor = user?.userType === "tutor";

  useEffect(() => {
    if (!ehTutor) return;
    PetsService.listarPets()
      .then((lista) => {
        setPets(lista);
        const encaminhado = lista.find((p) => String(p.id) === petIdInicial);
        if (encaminhado || lista[0]) setPetId((encaminhado ?? lista[0]).id);
      })
      .catch(() => setPets([]));
  }, [ehTutor, petIdInicial]);

  useEffect(() => {
    if (porDiaria || !servicoId || !data) return setSlots(null);
    setHorario("");
    PrestadoresService.disponibilidade(prestador.id, servicoId, data)
      .then((r) => setSlots(r.horarios))
      .catch(() => setSlots([]));
  }, [porDiaria, servicoId, data, prestador.id]);

  const servico = prestador.servicos.find((s) => s.id === servicoId);
  const dias = porDiaria ? diarias(data, horario, dataFim, horarioFim) : 1;
  const total = servico ? servico.preco * (porDiaria ? dias : 1) : null;

  if (!user) {
    return (
      <Alerta tipo="info">
        <Link href="/login" className="font-semibold underline">
          Entre como tutor
        </Link>{" "}
        para pedir este serviço.
      </Alerta>
    );
  }
  if (!ehTutor) return <Alerta tipo="info">Só contas de tutor podem pedir serviços.</Alerta>;
  if (prestador.limite_atingido) {
    return <Alerta tipo="info">Este profissional não está recebendo novos pedidos neste mês.</Alerta>;
  }
  if (enviado) {
    return (
      <Alerta tipo="sucesso">
        Pedido enviado! Você será avisado quando {prestador.nome} aceitar.{" "}
        <Link href="/dashboard/tutor" className="font-semibold underline">
          Ver meus agendamentos
        </Link>
      </Alerta>
    );
  }

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!horario) return setErro(porDiaria ? "Informe o horário de entrada." : "Escolha um horário disponível.");
    setEnviando(true);
    setErro(null);
    try {
      await PrestadoresService.pedir(prestador.id, {
        pet_id: petId,
        servico_id: servicoId,
        data,
        horario,
        ...(porDiaria ? { data_fim: dataFim, horario_fim: horarioFim || horario } : {}),
        local,
        observacoes: observacoes || null,
        encaminhamento_id: encaminhamentoId || null,
      });
      setEnviado(true);
    } catch (err) {
      setErro(handleApiError(err).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      {erro ? <Alerta>{erro}</Alerta> : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-slate-700">Serviço</legend>
        {prestador.servicos.map((s) => (
          <label
            key={s.id}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 ${
              servicoId === s.id ? "border-orange-400 bg-orange-50" : "border-slate-200"
            }`}
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="servico"
                className="accent-orange-500"
                checked={servicoId === s.id}
                onChange={() => setServicoId(s.id)}
              />
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800">{s.nome}</span>
                <span className="text-xs text-slate-500">{formatarDuracao(s.duracao_min)}</span>
              </span>
            </span>
            <span className="text-sm font-bold text-slate-800">{formatarPreco(s.preco)}</span>
          </label>
        ))}
      </fieldset>

      {pets.length ? (
        <Campo label="Pet">
          <select value={petId} onChange={(ev) => setPetId(ev.target.value)} className={inputClass} required>
            {pets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({p.especie})
              </option>
            ))}
          </select>
        </Campo>
      ) : (
        <Alerta tipo="info">
          Cadastre um pet no seu{" "}
          <Link href="/dashboard/tutor" className="font-semibold underline">
            painel
          </Link>{" "}
          antes de pedir.
        </Alerta>
      )}

      {prestador.atende_domicilio && prestador.atende_local_proprio ? (
        <fieldset className="flex flex-wrap gap-3">
          <legend className="mb-1 w-full text-sm font-semibold text-slate-700">Onde</legend>
          {(["domicilio", "local_proprio"] as const).map((opcao) => (
            <label key={opcao} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="local"
                className="accent-orange-500"
                checked={local === opcao}
                onChange={() => setLocal(opcao)}
              />
              {opcao === "domicilio" ? "Na minha casa" : "No espaço do profissional"}
            </label>
          ))}
        </fieldset>
      ) : null}

      {porDiaria ? (
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Entrada">
            <Entrada type="date" min={hoje()} value={data} onChange={(ev) => setData(ev.target.value)} required />
          </Campo>
          <Campo label="Horário de entrada">
            <Entrada type="time" value={horario} onChange={(ev) => setHorario(ev.target.value)} required />
          </Campo>
          <Campo label="Saída">
            <Entrada
              type="date"
              min={data || hoje()}
              value={dataFim}
              onChange={(ev) => setDataFim(ev.target.value)}
              required
            />
          </Campo>
          <Campo label="Horário de saída">
            <Entrada type="time" value={horarioFim} onChange={(ev) => setHorarioFim(ev.target.value)} />
          </Campo>
        </div>
      ) : (
        <>
          <Campo label="Data">
            <Entrada type="date" min={hoje()} value={data} onChange={(ev) => setData(ev.target.value)} required />
          </Campo>
          {slots !== null ? (
            slots.length ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Horários disponíveis">
                {slots.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHorario(h)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                      horario === h
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-slate-200 text-slate-700 hover:border-orange-300"
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Sem horários livres nesta data.</p>
            )
          ) : null}
        </>
      )}

      <MinhaAgendaDoDia data={data || null} horario={horario} duracaoMin={servico?.duracao_min ?? 60} />

      <Campo label="Observações (opcional)">
        <textarea
          value={observacoes}
          onChange={(ev) => setObservacoes(ev.target.value)}
          maxLength={255}
          rows={3}
          className={inputClass}
        />
      </Campo>

      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
        <span className="text-sm text-slate-600">
          {porDiaria ? `${dias || "-"} diária${dias === 1 ? "" : "s"}` : "Total"}
        </span>
        <span className="text-lg font-bold text-slate-900">{formatarPreco(porDiaria && !dias ? null : total)}</span>
      </div>

      <button type="submit" className={botaoPrimario} disabled={enviando || !pets.length || !servicoId}>
        {enviando ? "Enviando..." : "Pedir serviço"}
      </button>
    </form>
  );
}
