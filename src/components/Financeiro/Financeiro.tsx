"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Plus,
  Download,
  ArrowLeft,
  X,
  ReceiptText,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { urlDeLogin } from "@/lib/destino-login";
import { mensagemDeErro } from "@/lib/erros";
import {
  dinheiroEmCentavos,
  FORMAS_FINANCEIRO,
  hojeFinanceiro,
} from "@/lib/financeiro";
import {
  FinanceiroService,
  type PainelFinanceiro,
  type Lancamento,
  type DetalheFinanceiro,
  type AtendimentoFinanceiro,
} from "@/services/financeiro";
import s from "./financeiro.module.css";

const moeda = (v: number) =>
  (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (v: string) => v.split("-").reverse().join("/");
const labels: Record<string, string> = {
  aberto: "Em aberto",
  parcial: "Parcial",
  quitado: "Quitado",
  cancelado: "Cancelado",
  vencido: "Vencido",
};
const acoes: Record<string, string> = {
  criado: "Lançamento criado",
  editar: "Lançamento corrigido",
  baixar: "Pagamento registrado",
  desfazer: "Baixa desfeita",
  cancelar: "Lançamento cancelado",
};
const situacao = (i: Lancamento) =>
  i.estado !== "cancelado" &&
  i.estado !== "quitado" &&
  i.vencimento < hojeFinanceiro()
    ? "vencido"
    : i.estado;

function Modal({
  titulo,
  fechar,
  children,
}: {
  titulo: string;
  fechar: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={s.modal}
      aria-label={titulo}
      onCancel={(event) => {
        event.preventDefault();
        fechar();
      }}
    >
      <div className={s.modalHeader}>
        <h2>{titulo}</h2>
        <button type="button" onClick={fechar} aria-label="Fechar">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

type EditorProps = {
  item?: Lancamento;
  mes: string;
  clinica: boolean;
  ocupado: boolean;
  salvar: (v: Record<string, unknown>) => Promise<void>;
};
function Editor({ item, mes, clinica, ocupado, salvar }: EditorProps) {
  const [tipo, setTipo] = useState(item?.tipo || "receita");
  const [descricao, setDescricao] = useState(item?.descricao || "");
  const [valor, setValor] = useState(
    item ? (item.valorCentavos / 100).toFixed(2) : "",
  );
  const [categoria, setCategoria] = useState(item?.categoria || "Atendimento");
  const [contraparte, setContraparte] = useState(item?.contraparte || "");
  const [vencimento, setVencimento] = useState(
    item?.vencimento || hojeFinanceiro(),
  );
  const [agendamentoId, setAgendamentoId] = useState(item?.agendamentoId || "");
  const [atendimentos, setAtendimentos] = useState<AtendimentoFinanceiro[]>([]);
  const [erroAgenda, setErroAgenda] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (item) return;
    let ativo = true;
    FinanceiroService.atendimentos(mes)
      .then((a) => {
        if (ativo) setAtendimentos(a);
      })
      .catch(() => {
        if (ativo)
          setErroAgenda(
            "Não foi possível carregar a agenda. Você pode lançar manualmente.",
          );
      });
    return () => {
      ativo = false;
    };
  }, [item, mes]);
  function selecionar(id: string) {
    setAgendamentoId(id);
    const a = atendimentos.find((a) => a.id === id);
    if (!a) return;
    setDescricao(
      `Atendimento de ${a.pet?.nome || "pet"} — ${dataBR(a.dataConsulta || "")}`,
    );
    setContraparte(
      [a.tutor?.user?.nome, a.tutor?.user?.sobrenome].filter(Boolean).join(" "),
    );
    setVencimento(a.dataConsulta?.slice(0, 10) || hojeFinanceiro());
    if (!clinica && a.precoConsulta) setValor(a.precoConsulta);
  }
  return (
    <form
      className={s.form}
      onSubmit={async (e) => {
        e.preventDefault();
        setErro("");
        try {
          const fd = new FormData(e.currentTarget);
          await salvar({
            tipo,
            descricao,
            categoria,
            contraparte,
            vencimento,
            valorCentavos: dinheiroEmCentavos(valor),
            agendamentoId: agendamentoId || null,
            ...(item
              ? {
                  acao: "editar",
                  versao: item.versao,
                  motivo: fd.get("motivo"),
                }
              : {}),
          });
        } catch (e) {
          setErro(mensagemDeErro(e, "Não foi possível salvar."));
        }
      }}
    >
      {!item && (
        <label>
          Tipo
          <select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as "receita" | "despesa");
              setAgendamentoId("");
              setCategoria(
                e.target.value === "receita" ? "Atendimento" : "Materiais",
              );
            }}
          >
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
        </label>
      )}
      {!item && tipo === "receita" && (
        <label>
          Atendimento da Lince (opcional)
          <select
            value={agendamentoId}
            onChange={(e) => selecionar(e.target.value)}
          >
            <option value="">Lançamento manual / atendimento externo</option>
            {atendimentos.map((a) => (
              <option
                key={a.id}
                value={a.id}
                disabled={["cancelado", "cancelada", "recusado"].includes(
                  a.status.toLowerCase(),
                )}
              >
                {dataBR(a.dataConsulta || "")} · {a.pet?.nome || "Pet"} ·{" "}
                {a.status}
              </option>
            ))}
          </select>
          <small>
            Agenda do mês selecionado, até 100 atendimentos. Confirme o valor
            que pertence {clinica ? "à clínica" : "a você"}. Alterações na
            agenda não mudam este lançamento.
          </small>
        </label>
      )}
      {erroAgenda && <p role="status">{erroAgenda}</p>}
      <label>
        Descrição
        <input
          required
          maxLength={160}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: Consulta domiciliar da Luna"
        />
      </label>
      <div className={s.fields}>
        <label>
          Valor (R$)
          <input
            required
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
          />
        </label>
        <label>
          Vencimento
          <input
            required
            type="date"
            min="2000-01-01"
            max="2099-12-31"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
          />
        </label>
      </div>
      <label>
        Categoria
        <input
          required
          maxLength={60}
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          list="categorias-financeiro"
        />
      </label>
      <datalist id="categorias-financeiro">
        {[
          "Atendimento",
          "Exame",
          "Procedimento",
          "Honorários",
          "Deslocamento",
          "Materiais",
          "Aluguel",
          "Outros",
        ].map((c) => (
          <option key={c}>{c}</option>
        ))}
      </datalist>
      <label>
        Pagador ou favorecido
        <input
          required
          maxLength={160}
          value={contraparte}
          onChange={(e) => setContraparte(e.target.value)}
          placeholder="Tutor, clínica ou fornecedor"
        />
      </label>
      {item && (
        <label>
          Motivo da correção
          <input name="motivo" required maxLength={250} />
        </label>
      )}
      <p className={s.helper}>
        Salvar registra uma previsão. O pagamento deve ser confirmado
        separadamente.
      </p>
      {erro && (
        <p className={s.error} role="alert">
          {erro}
        </p>
      )}
      <button className={s.primary} disabled={ocupado} type="submit">
        {ocupado ? "Salvando…" : item ? "Salvar correção" : "Salvar lançamento"}
      </button>
    </form>
  );
}

export default function Financeiro({
  perfil,
}: {
  perfil: "veterinario" | "clinica";
}) {
  const { user, loading } = useAuth(),
    router = useRouter();
  const [mes, setMes] = useState(() => hojeFinanceiro().slice(0, 7)),
    [tipo, setTipo] = useState(""),
    [status, setStatus] = useState(""),
    [busca, setBusca] = useState(""),
    [pesquisa, setPesquisa] = useState(""),
    [pagina, setPagina] = useState(1);
  const [painel, setPainel] = useState<PainelFinanceiro | null>(null),
    [erro, setErro] = useState(""),
    [aviso, setAviso] = useState(""),
    [concluida, setConcluida] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [revisao, setRevisao] = useState(0);
  const [editor, setEditor] = useState<Lancamento | "novo" | null>(null),
    [detalhe, setDetalhe] = useState<DetalheFinanceiro | null>(null);
  const [acao, setAcao] = useState<{
    tipo: "baixar" | "cancelar" | "desfazer";
    item: Lancamento;
    baixaId?: string;
  } | null>(null);
  const chaveCriacao = useRef(""),
    chaveBaixa = useRef("");
  const params = useCallback(
    () =>
      new URLSearchParams({
        mes,
        tipo,
        situacao: status,
        busca: pesquisa,
        pagina: String(pagina),
      }),
    [mes, tipo, status, pesquisa, pagina],
  );
  const consulta = params().toString() + "/" + revisao;
  const carregando = concluida !== consulta;
  useEffect(() => {
    if (!loading && !user) router.replace(urlDeLogin());
  }, [loading, user, router]);
  useEffect(() => {
    if (!user || user.userType !== perfil) return;
    const controller = new AbortController();
    FinanceiroService.painel(params(), controller.signal)
      .then((dados) => {
        if (controller.signal.aborted) return;
        setPainel(dados);
        setErro("");
        setConcluida(consulta);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setPainel(null);
        setErro(mensagemDeErro(e, "Não foi possível carregar o financeiro."));
        setConcluida(consulta);
      });
    return () => controller.abort();
  }, [user, perfil, params, consulta]);
  async function executar(fn: () => Promise<unknown>) {
    setOcupado(true);
    setErro("");
    setAviso("");
    try {
      await fn();
      setRevisao((v) => v + 1);
      setAviso("Alteração salva com sucesso.");
    } finally {
      setOcupado(false);
    }
  }
  async function abrir(i: Lancamento) {
    try {
      setDetalhe(await FinanceiroService.detalhe(i.id));
      setErro("");
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível abrir o lançamento."));
    }
  }
  if (loading || !user)
    return (
      <main className={s.page}>
        <p>Carregando…</p>
      </main>
    );
  if (user.userType !== perfil)
    return (
      <main className={s.page}>
        <h1>Acesso restrito</h1>
        <p>
          Este financeiro pertence ao perfil de{" "}
          {perfil === "clinica" ? "clínica" : "veterinário"}.
        </p>
        <Link href={`/dashboard/${user.userType}`}>Voltar ao meu painel</Link>
      </main>
    );
  const r = painel?.resumo;
  return (
    <main className={s.page}>
      <Link className={s.back} href={`/dashboard/${perfil}`}>
        <ArrowLeft size={16} /> Voltar ao painel
      </Link>
      <header className={s.header}>
        <div>
          <span className={s.eyebrow}>
            {perfil === "clinica"
              ? "FINANCEIRO DA CLÍNICA"
              : "SEUS HONORÁRIOS, EM ORDEM"}
          </span>
          <h1>Controle financeiro</h1>
          <p>
            Organize receitas e despesas, acompanhe pagamentos e saiba o que
            ainda falta receber.
          </p>
        </div>
        <div className={s.actions}>
          <button
            className={s.secondary}
            disabled={!painel || carregando || ocupado}
            onClick={async () => {
              try {
                await executar(() => FinanceiroService.exportar(params()));
                setAviso("Arquivo CSV exportado.");
              } catch {
                setErro(
                  "Não foi possível exportar. Refine os filtros ou tente novamente.",
                );
              }
            }}
          >
            <Download size={17} /> Exportar CSV
          </button>
          {painel?.podeEditar && (
            <button
              className={s.primary}
              disabled={ocupado}
              onClick={() => {
                chaveCriacao.current = crypto.randomUUID();
                setEditor("novo");
              }}
            >
              <Plus size={18} /> Novo lançamento
            </button>
          )}
        </div>
      </header>
      {erro && (
        <div className={s.error} role="alert">
          {erro}
          <button
            className={s.secondary}
            onClick={() => setRevisao((v) => v + 1)}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {aviso && (
        <p className={s.success} role="status">
          {aviso}
        </p>
      )}
      {painel && !painel.podeEditar && (
        <aside className={s.notice}>
          <strong>Histórico em modo de consulta</strong>
          <p>
            Novos lançamentos e alterações estão disponíveis no{" "}
            {perfil === "clinica" ? "plano Grande" : "Vet Pro"}. Você pode
            consultar e exportar seus registros existentes.
          </p>
          <Link href={`/dashboard/${perfil}/alterar-plano`}>
            Conhecer os planos
          </Link>
        </aside>
      )}
      <section
        className={s.cards}
        aria-label="Resumo financeiro do mês"
        aria-busy={carregando}
      >
        {[
          ["Recebido no mês", r?.recebido, ArrowDownLeft, "entrada"],
          ["Despesas pagas no mês", r?.pago, ArrowUpRight, "saida"],
          ["A receber no período", r?.aReceber, ReceiptText, "pendente"],
          ["A pagar no período", r?.aPagar, ReceiptText, "pendente"],
          [
            "Resultado de caixa",
            r ? r.recebido - r.pago : undefined,
            Wallet,
            "resultado",
          ],
        ].map(([titulo, valor, Icone, tom]) => {
          const Icon = Icone as typeof Wallet;
          return (
            <article
              key={String(titulo)}
              className={`${s.card} ${s[String(tom)]}`}
            >
              <span>
                <Icon size={18} />
                {String(titulo)}
              </span>
              <strong>
                {carregando || valor === undefined ? "—" : moeda(Number(valor))}
              </strong>
              <small>
                {titulo === "Resultado de caixa"
                  ? "Recebido menos despesas pagas"
                  : titulo === "A receber no período"
                    ? `Vencidos: ${carregando ? "—" : moeda(r?.vencido || 0)}`
                    : titulo === "A pagar no período"
                      ? "Saldo pendente por vencimento"
                      : "Pela data de pagamento"}
              </small>
            </article>
          );
        })}
      </section>
      <section className={s.list} aria-label="Lançamentos financeiros">
        <div className={s.listHeader}>
          <div>
            <h2>Lançamentos</h2>
            <p>
              Filtre pelo mês de vencimento. O resumo considera o mês inteiro.
            </p>
          </div>
          <span>{painel?.total ?? 0} registros</span>
        </div>
        <form
          className={s.filters}
          onSubmit={(e) => {
            e.preventDefault();
            setPagina(1);
            setPesquisa(busca);
          }}
        >
          <label>
            Mês de vencimento
            <input
              type="month"
              min="2000-01"
              max="2099-12"
              value={mes}
              onChange={(e) => {
                if (e.target.value) {
                  setMes(e.target.value);
                  setPagina(1);
                }
              }}
            />
          </label>
          <label>
            Tipo
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value);
                setPagina(1);
              }}
            >
              <option value="">Todos</option>
              <option value="receita">Receitas</option>
              <option value="despesa">Despesas</option>
            </select>
          </label>
          <label>
            Situação
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPagina(1);
              }}
            >
              <option value="">Todas</option>
              {Object.entries(labels).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={s.search}>
            Buscar
            <input
              maxLength={160}
              placeholder="Descrição, categoria ou pagador"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <button className={s.secondary} type="submit">
            Filtrar
          </button>
        </form>
        {carregando ? (
          <p className={s.empty}>Carregando lançamentos…</p>
        ) : erro ? (
          <p className={s.empty}>
            Atualize os dados para visualizar os lançamentos.
          </p>
        ) : !painel?.itens.length ? (
          <div className={s.empty}>
            <ReceiptText size={32} />
            <h3>Nenhum lançamento neste período</h3>
            <p>
              {painel?.podeEditar
                ? "Registre uma receita ou despesa para começar, ou ajuste os filtros."
                : "Seus lançamentos existentes aparecerão aqui."}
            </p>
          </div>
        ) : (
          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Descrição / pagador</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Baixado</th>
                  <th>Pendente</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {painel.itens.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.descricao}</strong>
                      <small>
                        {i.contraparte} · {i.categoria}
                      </small>
                      <small
                        className={i.tipo === "receita" ? s.income : s.expense}
                      >
                        {i.tipo === "receita" ? "Receita" : "Despesa"}
                        {i.agendamentoId ? " · Agenda Lince" : " · Manual"}
                      </small>
                    </td>
                    <td data-label="Vencimento">{dataBR(i.vencimento)}</td>
                    <td data-label="Valor">{moeda(i.valorCentavos)}</td>
                    <td data-label="Baixado">{moeda(i.pagoCentavos)}</td>
                    <td data-label="Pendente">
                      {moeda(
                        i.estado === "cancelado"
                          ? 0
                          : i.valorCentavos - i.pagoCentavos,
                      )}
                    </td>
                    <td data-label="Situação">
                      <span className={`${s.badge} ${s[situacao(i)]}`}>
                        {labels[situacao(i)]}
                      </span>
                    </td>
                    <td>
                      <button
                        className={s.secondary}
                        aria-label={`Detalhes de ${i.descricao}`}
                        onClick={() => abrir(i)}
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {painel && (painel.total > 20 || pagina > 1) && (
          <nav className={s.pagination} aria-label="Páginas de lançamentos">
            <button
              className={s.secondary}
              disabled={pagina <= 1 || carregando}
              onClick={() => setPagina((v) => v - 1)}
            >
              Anterior
            </button>
            <span>
              Página {pagina} de {Math.ceil(painel.total / 20)}
            </span>
            <button
              className={s.secondary}
              disabled={pagina * 20 >= painel.total || carregando}
              onClick={() => setPagina((v) => v + 1)}
            >
              Próxima
            </button>
          </nav>
        )}
      </section>
      <p className={s.footnote}>
        Controle gerencial com base nos registros informados. Não representa
        saldo bancário, lucro contábil ou confirmação automática de cobrança.
        Nenhum dinheiro é movimentado pela Lince Pet neste módulo.
      </p>

      {editor && (
        <Modal
          titulo={editor === "novo" ? "Novo lançamento" : "Corrigir lançamento"}
          fechar={() => {
            if (!ocupado) setEditor(null);
          }}
        >
          <Editor
            item={editor === "novo" ? undefined : editor}
            mes={mes}
            clinica={perfil === "clinica"}
            ocupado={ocupado}
            salvar={async (v) => {
              await executar(() =>
                editor === "novo"
                  ? FinanceiroService.criar({ ...v, id: chaveCriacao.current })
                  : FinanceiroService.alterar(editor.id, v),
              );
              setEditor(null);
            }}
          />
        </Modal>
      )}
      {detalhe && (
        <Modal titulo="Detalhes do lançamento" fechar={() => setDetalhe(null)}>
          <div className={s.detail}>
            <span className={`${s.badge} ${s[situacao(detalhe)]}`}>
              {labels[situacao(detalhe)]}
            </span>
            <h3>{detalhe.descricao}</h3>
            <p>
              {detalhe.contraparte} · {detalhe.categoria}
            </p>
            <p>Vencimento: {dataBR(detalhe.vencimento)}</p>
            <div className={s.detailValues}>
              <div>
                Valor<strong>{moeda(detalhe.valorCentavos)}</strong>
              </div>
              <div>
                Baixado<strong>{moeda(detalhe.pagoCentavos)}</strong>
              </div>
              <div>
                Pendente
                <strong>
                  {moeda(
                    detalhe.estado === "cancelado"
                      ? 0
                      : detalhe.valorCentavos - detalhe.pagoCentavos,
                  )}
                </strong>
              </div>
            </div>
            {painel?.podeEditar && detalhe.estado !== "cancelado" && (
              <div className={s.actions}>
                {detalhe.pagoCentavos < detalhe.valorCentavos && (
                  <button
                    className={s.primary}
                    onClick={() => {
                      chaveBaixa.current = crypto.randomUUID();
                      setAcao({ tipo: "baixar", item: detalhe });
                      setDetalhe(null);
                    }}
                  >
                    Registrar pagamento
                  </button>
                )}
                <button
                  className={s.secondary}
                  onClick={() => {
                    setEditor(detalhe);
                    setDetalhe(null);
                  }}
                >
                  Corrigir lançamento
                </button>
                {!detalhe.pagoCentavos && (
                  <button
                    className={s.danger}
                    onClick={() => {
                      setAcao({ tipo: "cancelar", item: detalhe });
                      setDetalhe(null);
                    }}
                  >
                    Cancelar lançamento
                  </button>
                )}
              </div>
            )}
            <h3>Pagamentos registrados</h3>
            {!detalhe.baixas.length && <p>Nenhum pagamento registrado.</p>}
            {detalhe.baixas.map((b) => (
              <div className={s.historyRow} key={b.id}>
                <div>
                  <strong>{moeda(b.valorCentavos)}</strong>
                  <p>
                    {dataBR(b.data)} · {b.forma}
                    {b.desfeita ? " · Baixa desfeita" : ""}
                  </p>
                </div>
                {!b.desfeita && painel?.podeEditar && (
                  <button
                    className={s.secondary}
                    onClick={() => {
                      setAcao({
                        tipo: "desfazer",
                        item: detalhe,
                        baixaId: b.id,
                      });
                      setDetalhe(null);
                    }}
                  >
                    Desfazer baixa
                  </button>
                )}
              </div>
            ))}
            <h3>Histórico de alterações</h3>
            {detalhe.eventos.map((e) => (
              <div className={s.historyRow} key={e.id}>
                <div>
                  <strong>{acoes[e.acao] || e.acao}</strong>
                  <p>
                    {new Date(e.createdAt).toLocaleString("pt-BR")}
                    {e.motivo ? ` · ${e.motivo}` : ""}
                  </p>
                  <RegistroEvento dados={e.dados} />
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {acao && (
        <Modal
          titulo={
            acao.tipo === "baixar"
              ? "Registrar pagamento"
              : acao.tipo === "desfazer"
                ? "Desfazer baixa"
                : "Cancelar lançamento"
          }
          fechar={() => {
            if (!ocupado) setAcao(null);
          }}
        >
          <AcaoForm
            acao={acao.tipo}
            ocupado={ocupado}
            restante={acao.item.valorCentavos - acao.item.pagoCentavos}
            enviar={async (v) => {
              await executar(() =>
                FinanceiroService.alterar(acao.item.id, {
                  ...v,
                  acao: acao.tipo,
                  versao: acao.item.versao,
                  id: chaveBaixa.current,
                  baixaId: acao.baixaId,
                }),
              );
              setAcao(null);
            }}
          />
        </Modal>
      )}
    </main>
  );
}

function RegistroEvento({ dados }: { dados: Record<string, unknown> }) {
  const antes = dados.antes as Record<string, unknown> | undefined,
    depois = dados.depois as Record<string, unknown> | undefined;
  if (antes && depois)
    return (
      <details>
        <summary>Ver correção</summary>
        {(
          [
            "descricao",
            "categoria",
            "contraparte",
            "vencimento",
            "valorCentavos",
          ] as const
        )
          .filter((c) => antes[c] !== depois[c])
          .map((c) => {
            const nomes = {
              descricao: "Descrição",
              categoria: "Categoria",
              contraparte: "Pagador ou favorecido",
              vencimento: "Vencimento",
              valorCentavos: "Valor",
            };
            const formatar = (v: unknown) =>
              c === "valorCentavos"
                ? moeda(Number(v))
                : c === "vencimento"
                  ? dataBR(String(v))
                  : String(v);
            return (
              <p key={c}>
                {nomes[c]}: {formatar(antes[c])} → {formatar(depois[c])}
              </p>
            );
          })}
      </details>
    );
  return typeof dados.valorCentavos === "number" ? (
    <p>
      {moeda(dados.valorCentavos)}
      {typeof dados.forma === "string" ? ` · ${dados.forma}` : ""}
      {typeof dados.data === "string" ? ` · ${dataBR(dados.data)}` : ""}
    </p>
  ) : null;
}

function AcaoForm({
  acao,
  restante,
  ocupado,
  enviar,
}: {
  acao: string;
  restante: number;
  ocupado: boolean;
  enviar: (v: Record<string, unknown>) => Promise<void>;
}) {
  const [erro, setErro] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro("");
    try {
      const f = new FormData(e.currentTarget);
      await enviar(
        acao === "baixar"
          ? {
              valorCentavos: dinheiroEmCentavos(String(f.get("valor"))),
              data: f.get("data"),
              forma: f.get("forma"),
            }
          : { motivo: f.get("motivo") },
      );
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível salvar a alteração."));
    }
  }
  return (
    <form onSubmit={submit} className={s.form}>
      {acao === "baixar" ? (
        <>
          <p>
            Saldo pendente: <strong>{moeda(restante)}</strong>. Informe somente
            o valor efetivamente pago.
          </p>
          <label>
            Valor pago (R$)
            <input
              required
              name="valor"
              inputMode="decimal"
              defaultValue={(restante / 100).toFixed(2)}
            />
          </label>
          <label>
            Data do pagamento
            <input
              required
              type="date"
              name="data"
              min="2000-01-01"
              max={hojeFinanceiro()}
              defaultValue={hojeFinanceiro()}
            />
          </label>
          <label>
            Forma de pagamento
            <select name="forma">
              {FORMAS_FINANCEIRO.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <>
          <p>
            {acao === "desfazer"
              ? "Use para corrigir um registro incorreto. A baixa original permanece no histórico. Esta ação não realiza reembolso."
              : "O lançamento continuará no histórico, sem compor os valores previstos. Nenhuma cobrança ou consulta será cancelada."}
          </p>
          <label>
            Motivo
            <input name="motivo" maxLength={250} required />
          </label>
        </>
      )}
      {erro && (
        <p className={s.error} role="alert">
          {erro}
        </p>
      )}
      <button
        className={acao === "baixar" ? s.primary : s.danger}
        type="submit"
        disabled={ocupado}
      >
        {ocupado
          ? "Salvando…"
          : acao === "baixar"
            ? "Confirmar pagamento"
            : "Confirmar alteração"}
      </button>
    </form>
  );
}
