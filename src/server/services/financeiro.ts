import "server-only";
import { prisma } from "../db";
import type { CurrentUser } from "../auth/session";
import type { Prisma } from "@/generated/prisma/client";
import {
  ErroFinanceiro,
  podeEscreverFinanceiro,
  validarLancamento,
  uuidFinanceiro,
  centavos,
  dataFinanceiro,
  estadoFinanceiro,
  textoFinanceiro,
  hojeFinanceiro,
  FORMAS_FINANCEIRO,
  celulaCsv,
} from "@/lib/financeiro";

type Dono = { userId: string; perfil: string };
function acesso(
  user: CurrentUser,
  escrita = false,
): Dono & { podeEditar: boolean } {
  if (!["veterinario", "clinica"].includes(user.userType))
    throw new ErroFinanceiro(
      "Financeiro disponível somente para veterinários e contas de clínicas.",
      403,
    );
  const plano =
    user.userType === "clinica"
      ? user.clinica?.subscriptionPlanCode
      : user.veterinario?.subscriptionPlanCode;
  const podeEditar = podeEscreverFinanceiro(user.userType, plano);
  if (escrita && !podeEditar)
    throw new ErroFinanceiro(
      "Novos lançamentos e alterações exigem Vet Pro ou Clínica Grande. Seu histórico continua disponível para consulta e exportação.",
      403,
    );
  return { userId: user.id, perfil: user.userType, podeEditar };
}
function filtro(q: URLSearchParams) {
  const mes = q.get("mes") || hojeFinanceiro().slice(0, 7);
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(mes))
    throw new ErroFinanceiro("Mês inválido.");
  const tipo = q.get("tipo") || "";
  const situacao = q.get("situacao") || "";
  if (tipo && !["receita", "despesa"].includes(tipo))
    throw new ErroFinanceiro("Tipo inválido.");
  if (
    situacao &&
    !["aberto", "parcial", "quitado", "cancelado", "vencido"].includes(situacao)
  )
    throw new ErroFinanceiro("Situação inválida.");
  const busca = (q.get("busca") || "").trim();
  if (busca.length > 160) throw new ErroFinanceiro("Busca muito longa.");
  const pagina = Number(q.get("pagina") || 1);
  if (!Number.isInteger(pagina) || pagina < 1 || pagina > 100000)
    throw new ErroFinanceiro("Página inválida.");
  const [ano, m] = mes.split("-").map(Number);
  const fim = new Date(Date.UTC(ano, m, 0)).toISOString().slice(0, 10);
  return {
    mes,
    tipo,
    situacao,
    busca,
    pagina,
    periodo: { gte: `${mes}-01`, lte: fim },
  };
}
function whereLancamento(
  dono: Dono,
  f: ReturnType<typeof filtro>,
): Prisma.FinanceiroLancamentoWhereInput {
  return {
    userId: dono.userId,
    perfil: dono.perfil,
    vencimento:
      f.situacao === "vencido"
        ? { ...f.periodo, lt: hojeFinanceiro() }
        : f.periodo,
    ...(f.tipo ? { tipo: f.tipo } : {}),
    ...(f.situacao === "vencido"
      ? { estado: { in: ["aberto", "parcial"] } }
      : f.situacao
        ? { estado: f.situacao }
        : {}),
    ...(f.busca
      ? {
          OR: ["descricao", "categoria", "contraparte"].map((campo) => ({
            [campo]: { contains: f.busca, mode: "insensitive" },
          })),
        }
      : {}),
  };
}
export async function painelFinanceiro(user: CurrentUser, q: URLSearchParams) {
  const { userId, perfil, podeEditar } = acesso(user);
  const f = filtro(q),
    dono = { userId, perfil },
    where = whereLancamento(dono, f);
  // Resumo do mês inteiro; filtros adicionais afetam apenas a listagem.
  const resumo = {
    ...dono,
    vencimento: f.periodo,
    estado: { not: "cancelado" },
  };
  return prisma.$transaction(
    async (tx) => {
      const [itens, total, receitas, despesas, vencidas, recebido, pago] =
        await Promise.all([
          tx.financeiroLancamento.findMany({
            where,
            orderBy: [{ vencimento: "desc" }, { id: "asc" }],
            skip: (f.pagina - 1) * 20,
            take: 20,
          }),
          tx.financeiroLancamento.count({ where }),
          tx.financeiroLancamento.aggregate({
            where: { ...resumo, tipo: "receita" },
            _sum: { valorCentavos: true, pagoCentavos: true },
          }),
          tx.financeiroLancamento.aggregate({
            where: { ...resumo, tipo: "despesa" },
            _sum: { valorCentavos: true, pagoCentavos: true },
          }),
          tx.financeiroLancamento.aggregate({
            where: {
              ...resumo,
              tipo: "receita",
              vencimento: { ...f.periodo, lt: hojeFinanceiro() },
            },
            _sum: { valorCentavos: true, pagoCentavos: true },
          }),
          tx.financeiroBaixa.aggregate({
            where: {
              desfeita: 0,
              data: f.periodo,
              lancamento: { ...dono, tipo: "receita" },
            },
            _sum: { valorCentavos: true },
          }),
          tx.financeiroBaixa.aggregate({
            where: {
              desfeita: 0,
              data: f.periodo,
              lancamento: { ...dono, tipo: "despesa" },
            },
            _sum: { valorCentavos: true },
          }),
        ]);
      const pendente = (s: {
        valorCentavos: number | null;
        pagoCentavos: number | null;
      }) => (s.valorCentavos || 0) - (s.pagoCentavos || 0);
      return {
        podeEditar,
        perfil,
        mes: f.mes,
        itens,
        total,
        pagina: f.pagina,
        resumo: {
          recebido: recebido._sum.valorCentavos || 0,
          pago: pago._sum.valorCentavos || 0,
          aReceber: pendente(receitas._sum),
          aPagar: pendente(despesas._sum),
          vencido: pendente(vencidas._sum),
        },
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
async function atendimentoDoDono(dono: Dono, id: string) {
  const filtroDono =
    dono.perfil === "clinica"
      ? { clinica: { userId: dono.userId } }
      : { veterinario: { userId: dono.userId } };
  const a = await prisma.agendamento.findFirst({
    where: { id, ...filtroDono },
  });
  if (!a)
    throw new ErroFinanceiro(
      "Atendimento não encontrado para este perfil.",
      404,
    );
  if (["cancelado", "cancelada", "recusado"].includes(a.status.toLowerCase()))
    throw new ErroFinanceiro(
      "Não é possível vincular um atendimento cancelado ou recusado.",
      409,
    );
  return a;
}
export async function atendimentosFinanceiro(
  user: CurrentUser,
  q: URLSearchParams,
) {
  const { userId, perfil } = acesso(user, true),
    f = filtro(q);
  return prisma.agendamento.findMany({
    where: {
      ...(perfil === "clinica"
        ? { clinica: { userId } }
        : { veterinario: { userId } }),
      dataConsulta: f.periodo,
    },
    select: {
      id: true,
      dataConsulta: true,
      status: true,
      precoConsulta: true,
      pet: { select: { nome: true } },
      tutor: { select: { user: { select: { nome: true, sobrenome: true } } } },
    },
    orderBy: [{ dataConsulta: "desc" }, { id: "asc" }],
    take: 100,
  });
}
export async function criarFinanceiro(
  user: CurrentUser,
  body: Record<string, unknown>,
) {
  const { userId, perfil } = acesso(user, true),
    dono = { userId, perfil };
  const id = uuidFinanceiro(body.id),
    dados = validarLancamento(body);
  if (dados.agendamentoId) await atendimentoDoDono(dono, dados.agendamentoId);
  try {
    return await prisma.$transaction(async (tx) => {
      const existente = await tx.financeiroLancamento.findFirst({
        where: { id, ...dono },
      });
      if (existente) {
        const campos = Object.keys(dados) as Array<keyof typeof dados>;
        if (campos.some((campo) => existente[campo] !== dados[campo]))
          throw new ErroFinanceiro(
            "Esta requisição já foi utilizada com outros dados. Atualize a página antes de criar outro lançamento.",
            409,
          );
        return existente;
      }
      return tx.financeiroLancamento.create({
        data: {
          id,
          ...dono,
          ...dados,
          eventos: { create: { acao: "criado", dados } },
        },
      });
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002")
      throw new ErroFinanceiro(
        "Este atendimento já possui lançamento neste perfil ou a requisição já foi utilizada.",
        409,
      );
    throw e;
  }
}
export async function detalheFinanceiro(user: CurrentUser, id: string) {
  const { userId, perfil } = acesso(user);
  uuidFinanceiro(id);
  const item = await prisma.financeiroLancamento.findFirst({
    where: { id, userId, perfil },
    include: {
      baixas: { orderBy: { createdAt: "desc" } },
      eventos: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!item) throw new ErroFinanceiro("Lançamento não encontrado.", 404);
  return item;
}
export async function alterarFinanceiro(
  user: CurrentUser,
  id: string,
  body: Record<string, unknown>,
) {
  const { userId, perfil } = acesso(user, true),
    dono = { userId, perfil };
  uuidFinanceiro(id);
  return prisma.$transaction(async (tx) => {
    // Serializa baixas/correções concorrentes; a segunda operação recarrega o saldo após o lock.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`financeiro:${id}`}, 0))`;
    const item = await tx.financeiroLancamento.findFirst({
      where: { id, ...dono },
    });
    if (!item) throw new ErroFinanceiro("Lançamento não encontrado.", 404);
    if (body.acao === "baixar") {
      const baixaId = uuidFinanceiro(body.id);
      const existente = await tx.financeiroBaixa.findUnique({
        where: { id: baixaId },
      });
      if (existente) {
        if (
          existente.lancamentoId !== id ||
          existente.valorCentavos !== body.valorCentavos ||
          existente.data !== body.data ||
          existente.forma !== body.forma
        )
          throw new ErroFinanceiro("Identificador de baixa já utilizado.", 409);
        return item;
      }
    }
    if (body.versao !== item.versao)
      throw new ErroFinanceiro(
        "Este lançamento foi alterado. Atualize a tela e tente novamente.",
        409,
      );
    if (item.estado === "cancelado")
      throw new ErroFinanceiro(
        "Lançamentos cancelados não podem ser alterados.",
        409,
      );
    let dados: Prisma.FinanceiroLancamentoUpdateInput = {};
    let evento: Prisma.InputJsonObject = {};
    let motivo: string | undefined;
    if (body.acao === "editar") {
      const novos = validarLancamento({
        ...body,
        tipo: item.tipo,
        agendamentoId: item.agendamentoId,
      });
      dados = {
        ...novos,
        estado: estadoFinanceiro(novos.valorCentavos, item.pagoCentavos),
      };
      motivo = textoFinanceiro(body.motivo, "Motivo da correção", 250);
      evento = {
        antes: {
          descricao: item.descricao,
          valorCentavos: item.valorCentavos,
          categoria: item.categoria,
          contraparte: item.contraparte,
          vencimento: item.vencimento,
        },
        depois: novos,
      };
    } else if (body.acao === "baixar") {
      const valor = centavos(body.valorCentavos),
        data = dataFinanceiro(body.data);
      if (data > hojeFinanceiro())
        throw new ErroFinanceiro(
          "A data do pagamento não pode estar no futuro.",
        );
      if (
        !FORMAS_FINANCEIRO.includes(
          body.forma as (typeof FORMAS_FINANCEIRO)[number],
        )
      )
        throw new ErroFinanceiro("Forma de pagamento inválida.");
      const pagoCentavos = item.pagoCentavos + valor;
      dados = {
        pagoCentavos,
        estado: estadoFinanceiro(item.valorCentavos, pagoCentavos),
      };
      const baixa = await tx.financeiroBaixa.create({
        data: {
          id: uuidFinanceiro(body.id),
          lancamentoId: id,
          valorCentavos: valor,
          data,
          forma: String(body.forma),
        },
      });
      evento = {
        baixaId: baixa.id,
        valorCentavos: valor,
        data,
        forma: baixa.forma,
      };
    } else if (body.acao === "desfazer") {
      motivo = textoFinanceiro(body.motivo, "Motivo da correção", 250);
      const baixa = await tx.financeiroBaixa.findFirst({
        where: {
          id: uuidFinanceiro(body.baixaId),
          lancamentoId: id,
          desfeita: 0,
        },
      });
      if (!baixa)
        throw new ErroFinanceiro("Baixa não encontrada ou já desfeita.", 409);
      await tx.financeiroBaixa.update({
        where: { id: baixa.id },
        data: { desfeita: 1 },
      });
      const pagoCentavos = item.pagoCentavos - baixa.valorCentavos;
      dados = {
        pagoCentavos,
        estado: estadoFinanceiro(item.valorCentavos, pagoCentavos),
      };
      evento = { baixaId: baixa.id, valorCentavos: baixa.valorCentavos };
    } else if (body.acao === "cancelar") {
      if (item.pagoCentavos)
        throw new ErroFinanceiro(
          "Desfaça as baixas antes de cancelar. Cancelar não devolve dinheiro ao cliente.",
          409,
        );
      motivo = textoFinanceiro(body.motivo, "Motivo do cancelamento", 250);
      dados = { estado: "cancelado" };
    } else throw new ErroFinanceiro("Ação inválida.");
    return tx.financeiroLancamento.update({
      where: { id },
      data: {
        ...dados,
        versao: { increment: 1 },
        eventos: { create: { acao: String(body.acao), motivo, dados: evento } },
      },
    });
  });
}
export async function exportarFinanceiro(
  user: CurrentUser,
  q: URLSearchParams,
) {
  const { userId, perfil } = acesso(user),
    f = filtro(q),
    where = whereLancamento({ userId, perfil }, f);
  const itens = await prisma.financeiroLancamento.findMany({
    where,
    orderBy: [{ vencimento: "asc" }, { id: "asc" }],
    take: 10001,
    include: { baixas: { orderBy: { createdAt: "asc" } } },
  });
  if (itens.length > 10000)
    throw new ErroFinanceiro(
      "Mais de 10.000 lançamentos. Refine os filtros antes de exportar.",
    );
  const linhas: unknown[][] = [
    [
      "Registro",
      "Identificador",
      "Tipo",
      "Descrição",
      "Categoria",
      "Pagador/Favorecido",
      "Vencimento",
      "Valor (R$)",
      "Baixado (R$)",
      "Pendente (R$)",
      "Situação",
      "Data do pagamento",
      "Forma",
      "Atendimento",
    ],
  ];
  for (const i of itens) {
    linhas.push([
      "Lançamento",
      i.id,
      i.tipo,
      i.descricao,
      i.categoria,
      i.contraparte,
      i.vencimento,
      (i.valorCentavos / 100).toFixed(2).replace(".", ","),
      (i.pagoCentavos / 100).toFixed(2).replace(".", ","),
      i.estado === "cancelado"
        ? "0,00"
        : ((i.valorCentavos - i.pagoCentavos) / 100)
            .toFixed(2)
            .replace(".", ","),
      i.estado,
      "",
      "",
      i.agendamentoId,
    ]);
    for (const b of i.baixas)
      linhas.push([
        "Baixa",
        b.id,
        i.tipo,
        i.descricao,
        i.categoria,
        i.contraparte,
        "",
        (b.valorCentavos / 100).toFixed(2).replace(".", ","),
        "",
        "",
        b.desfeita ? "desfeita" : "confirmada",
        b.data,
        b.forma,
        i.agendamentoId,
      ]);
  }
  return "\uFEFF" + linhas.map((l) => l.map(celulaCsv).join(";")).join("\r\n");
}
