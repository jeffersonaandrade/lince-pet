"use client";

import { useCallback, useEffect, useState } from "react";
import { mensagemDeErro } from "@/lib/erros";
import { ExamesClinicaService, formatarPreco, type AgendamentoExame } from "@/services/exames/exames";
import { botaoPerigo, botaoPrimario, botaoSecundario, campo, Mensagem, Secao } from "./ui";

const LAUDO_MAX_MB = 10;

const ROTULO: Record<string, string> = {
  confirmado: "Confirmado",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

const COR: Record<string, string> = {
  confirmado: "bg-blue-50 text-blue-700",
  realizado: "bg-emerald-50 text-emerald-700",
  cancelado: "bg-red-50 text-red-700",
};

const quando = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })
    : "";

const hojeIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

function ItemAgenda({ a, onMudou }: { a: AgendamentoExame; onMudou: () => void }) {
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const comecou = a.inicio_em ? new Date(a.inicio_em) <= new Date() : false;

  async function executar(acao: () => Promise<unknown>, sucesso: string, padrao: string) {
    setOcupado(true);
    setErro(null);
    setOk(null);
    try {
      await acao();
      setOk(sucesso);
      onMudou();
    } catch (error) {
      setErro(mensagemDeErro(error, padrao));
    } finally {
      setOcupado(false);
    }
  }

  function enviarLaudo(arquivo: File | undefined) {
    if (!arquivo) return;
    if (arquivo.type !== "application/pdf" && !arquivo.name.toLowerCase().endsWith(".pdf")) {
      setErro("O laudo precisa ser um arquivo PDF.");
      return;
    }
    if (arquivo.size > LAUDO_MAX_MB * 1024 * 1024) {
      setErro(`O laudo pode ter no máximo ${LAUDO_MAX_MB} MB.`);
      return;
    }
    void executar(() => ExamesClinicaService.enviarLaudo(a.id, arquivo), "Laudo enviado. O tutor foi avisado.", "Não foi possível enviar o laudo.");
  }

  return (
    <li aria-label={`Exame de ${a.pet?.nome ?? "pet"}`} className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-800">
            {quando(a.inicio_em)} · {a.pet?.nome ?? "Pet"}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${COR[a.status] ?? "bg-slate-100 text-slate-600"}`}>
              {ROTULO[a.status] ?? a.status}
            </span>
          </p>
          <p className="text-sm text-slate-600">{a.exames.map((e) => e.nome).join(", ")}</p>
          <p className="text-sm text-slate-500">
            Tutor: {a.tutor?.nome ?? "-"}
            {a.tutor?.celular ? ` · ${a.tutor.celular}` : ""} · {formatarPreco(a.preco)} (pagamento na clínica)
          </p>
          {a.motivo_cancelamento ? <p className="text-xs text-red-600">Motivo: {a.motivo_cancelamento}</p> : null}
          {a.laudo ? <p className="mt-1 text-xs font-medium text-emerald-700">Laudo enviado: {a.laudo.nome_arquivo ?? "PDF"}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {a.status === "confirmado" && comecou ? (
            <button
              type="button"
              className={botaoSecundario}
              disabled={ocupado}
              onClick={() => executar(() => ExamesClinicaService.marcarRealizado(a.id), "Exame marcado como realizado.", "Não foi possível atualizar.")}
            >
              Marcar realizado
            </button>
          ) : null}
          {a.status === "confirmado" ? (
            <button type="button" className={botaoPerigo} disabled={ocupado} onClick={() => setCancelando((v) => !v)}>
              Cancelar
            </button>
          ) : null}
          {a.status === "realizado" ? (
            <label className={`${botaoPrimario} cursor-pointer`}>
              {a.laudo ? "Substituir laudo" : "Enviar laudo"}
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                disabled={ocupado}
                aria-label={`Laudo em PDF do exame de ${a.pet?.nome ?? "pet"}`}
                onChange={(e) => {
                  enviarLaudo(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
      </div>
      {cancelando ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className={campo}
            aria-label="Motivo do cancelamento"
            placeholder="Motivo (o tutor verá)"
            value={motivo}
            maxLength={255}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <button
            type="button"
            className={botaoPerigo}
            disabled={ocupado || !motivo.trim()}
            onClick={() => executar(() => ExamesClinicaService.cancelar(a.id, motivo), "Exame cancelado. O tutor foi avisado.", "Não foi possível cancelar.")}
          >
            Confirmar cancelamento
          </button>
        </div>
      ) : null}
      <Mensagem texto={erro} />
      <Mensagem texto={ok} tipo="ok" />
    </li>
  );
}

/** Agenda de exames da clínica: próximos 30 dias a partir da data escolhida. */
export function AgendaExames() {
  const [de, setDe] = useState(hojeIso);
  const [lista, setLista] = useState<AgendamentoExame[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [versao, setVersao] = useState(0);
  const carregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let atual = true;
    ExamesClinicaService.agenda({ de })
      .then((l) => {
        if (!atual) return;
        setLista(l);
        setErro(null);
      })
      .catch((error) => atual && setErro(mensagemDeErro(error, "Não foi possível carregar a agenda de exames.")));
    return () => {
      atual = false;
    };
  }, [de, versao]);

  return (
    <Secao titulo="Agenda de exames" descricao="Exames agendados pelos tutores. Depois do horário, marque como realizado e envie o laudo em PDF." rotulo="Agenda de exames">
      <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
        A partir de
        <input type="date" className={`${campo} w-auto`} value={de} onChange={(e) => setDe(e.target.value)} />
      </label>
      <Mensagem texto={erro} />
      {lista === null ? <p className="text-sm text-slate-500">Carregando...</p> : null}
      {lista?.length === 0 ? <p className="text-sm text-slate-500">Nenhum exame agendado neste período.</p> : null}
      <ul className="flex flex-col gap-3">
        {lista?.map((a) => <ItemAgenda key={a.id} a={a} onMudou={carregar} />)}
      </ul>
    </Secao>
  );
}
