import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { test, expect, sessao, CONTAS } from "./fixtures";
import { consultar } from "./db";
import { hojeFinanceiro } from "../src/lib/financeiro";
import type { APIRequestContext, Page } from "@playwright/test";

const pasta = "docs/evidencias/financeiro-2026-11-02";
mkdirSync(pasta, { recursive: true });
const hoje = hojeFinanceiro(),
  mes = hoje.slice(0, 7);
type Perfil = "veterinario" | "clinica";
const criados: string[] = [];
const agendas: string[] = [];
async function dadosDono(perfil: Perfil) {
  const tabela = perfil === "clinica" ? "clinicas" : "veterinarios";
  const [d] = await consultar<{
    id: string;
    user_id: string;
    subscription_plan_code: string;
  }>(
    `select p.id, p.user_id, p.subscription_plan_code from ${tabela} p join users u on u.id=p.user_id where u.email=$1`,
    [CONTAS[perfil].email],
  );
  return d;
}
async function plano(perfil: Perfil, code: string) {
  await consultar(
    `update ${perfil === "clinica" ? "clinicas" : "veterinarios"} set subscription_plan_code=$1 where user_id=(select id from users where email=$2)`,
    [code, CONTAS[perfil].email],
  );
}
function dados(patch: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    tipo: "receita",
    descricao: "Consulta domiciliar — Luna",
    categoria: "Atendimento",
    contraparte: "Ana Souza",
    valorCentavos: 30000,
    vencimento: hoje,
    ...patch,
  };
}
async function criar(
  request: APIRequestContext,
  patch: Record<string, unknown> = {},
) {
  const d = dados(patch),
    res = await request.post("/api/financeiro", { data: d });
  expect(res.status(), await res.text()).toBe(201);
  criados.push(d.id);
  return res.json();
}
async function pagar(
  request: APIRequestContext,
  item: { id: string; versao: number },
  valor: number,
  patch: Record<string, unknown> = {},
) {
  return request.patch(`/api/financeiro/${item.id}`, {
    data: {
      acao: "baixar",
      id: randomUUID(),
      versao: item.versao,
      valorCentavos: valor,
      data: hoje,
      forma: "Pix",
      ...patch,
    },
  });
}
async function print(page: Page, nome: string) {
  await page.evaluate(() =>
    window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const path = `${pasta}/${nome}.png`;
  if (await page.getByRole("dialog").count()) await page.screenshot({ path });
  else await page.locator("main").last().screenshot({ path });
}

for (const perfil of ["veterinario", "clinica"] as const) {
  test.describe.serial(`financeiro ${perfil}`, () => {
    test.use({ storageState: sessao(perfil) });
    let anterior: string;
    test.beforeAll(async () => {
      anterior = (await dadosDono(perfil)).subscription_plan_code;
      await plano(perfil, perfil === "clinica" ? "clinic_pro" : "vet_pro");
    });
    test.afterAll(async () => {
      if (criados.length) {
        await consultar(
          "delete from financeiro_eventos where lancamento_id = any($1::uuid[])",
          [criados],
        );
        await consultar(
          "delete from financeiro_baixas where lancamento_id = any($1::uuid[])",
          [criados],
        );
        await consultar(
          "delete from financeiro_lancamentos where id = any($1::uuid[])",
          [criados],
        );
        criados.length = 0;
      }
      if (agendas.length) {
        await consultar("delete from agendamentos where id=any($1::text[])", [
          agendas,
        ]);
        agendas.length = 0;
      }
      await plano(perfil, anterior);
    });

    test("cria pela tela, registra parcial, rejeita excesso e exporta com dados reais", async ({
      page,
    }) => {
      test.setTimeout(120000);
      await page.goto(`/dashboard/${perfil}/financeiro`);
      await expect(
        page.getByRole("button", { name: "Novo lançamento", exact: true }),
      ).toBeVisible();
      const antes = await (
        await page.request.get(`/api/financeiro?mes=${mes}`)
      ).json();
      await page
        .getByRole("button", { name: "Novo lançamento", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Descrição", { exact: true })
        .fill("Consulta domiciliar — Luna");
      await dialog.getByLabel("Valor (R$)", { exact: true }).fill("300,00");
      await dialog.getByLabel("Pagador ou favorecido").fill("Ana Souza");
      const gravacao = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/financeiro") &&
          r.request().method() === "POST",
      );
      await dialog.getByRole("button", { name: "Salvar lançamento" }).click();
      const item = await (await gravacao).json();
      criados.push(item.id);
      await expect(dialog).toHaveCount(0);
      await page
        .getByRole("button", { name: "Detalhes de Consulta domiciliar — Luna" })
        .click();
      await dialog
        .getByRole("button", { name: "Registrar pagamento", exact: true })
        .click();
      await dialog.getByLabel("Valor pago (R$)").fill("100,00");
      await dialog.getByRole("button", { name: "Confirmar pagamento" }).click();
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByRole("row").filter({ hasText: "Consulta domiciliar — Luna" }),
      ).toContainText("Parcial");
      const parcial = await (
        await page.request.get(`/api/financeiro/${item.id}`)
      ).json();
      expect(parcial.pagoCentavos).toBe(10000);
      expect(parcial.eventos.map((e: { acao: string }) => e.acao)).toContain(
        "baixar",
      );

      await page
        .getByRole("button", { name: "Detalhes de Consulta domiciliar — Luna" })
        .click();
      await dialog
        .getByRole("button", { name: "Registrar pagamento", exact: true })
        .click();
      await dialog.getByLabel("Valor pago (R$)").fill("250,00");
      await dialog.getByRole("button", { name: "Confirmar pagamento" }).click();
      await expect(dialog.getByRole("alert")).toContainText("não pode superar");
      await print(page, `${perfil}-negativo-pagamento-acima-saldo`);
      await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
      const apos = await (
        await page.request.get(`/api/financeiro?mes=${mes}`)
      ).json();
      expect(apos.resumo.recebido - antes.resumo.recebido).toBe(10000);
      expect(apos.resumo.aReceber - antes.resumo.aReceber).toBe(20000);
      expect(
        (await (await page.request.get(`/api/financeiro/${item.id}`)).json())
          .baixas,
      ).toHaveLength(1);
      const despesa = await criar(page.request, {
        tipo: "despesa",
        descricao: "Materiais e insumos",
        categoria: "Materiais",
        contraparte: "Fornecedor veterinário",
        valorCentavos: 8500,
      });
      expect((await pagar(page.request, despesa, 8500)).status()).toBe(200);
      const outra = await criar(page.request, {
        descricao:
          perfil === "clinica"
            ? "Exame de ultrassom — Thor"
            : "Honorários — Clínica São Lucas",
        contraparte: perfil === "clinica" ? "Carlos Lima" : "Clínica São Lucas",
        valorCentavos: 45000,
        categoria: perfil === "clinica" ? "Exame" : "Honorários",
      });
      expect((await pagar(page.request, outra, 45000)).status()).toBe(200);
      await criar(page.request, {
        descricao: "Aluguel do consultório",
        tipo: "despesa",
        categoria: "Aluguel",
        contraparte: "Espaço veterinário",
        valorCentavos: 60000,
      });
      await page.reload();
      await expect(page.getByText("Carregando lançamentos…")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Detalhes de Materiais e insumos" }),
      ).toBeVisible();
      await print(page, `${perfil}-positivo-painel`);
      await page.setViewportSize({ width: 390, height: 844 });
      await print(page, `${perfil}-positivo-celular`);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.setViewportSize({ width: 1440, height: 1000 });
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Exportar CSV" }).click();
      expect((await download).suggestedFilename()).toBe(
        "controle-financeiro.csv",
      );
      const csv = await page.request.get(`/api/financeiro/exportar?mes=${mes}`);
      expect(csv.status()).toBe(200);
      expect(await csv.text()).toContain("Consulta domiciliar — Luna");
      expect(await csv.text()).toContain('"Baixa"');
      expect(await csv.text()).toContain('"300,00"');
      await page
        .getByRole("button", { name: "Detalhes de Consulta domiciliar — Luna" })
        .click();
      await expect(
        dialog.getByRole("heading", { name: "Histórico de alterações" }),
      ).toBeVisible();
      await print(page, `${perfil}-positivo-historico`);
      await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
      await page.goto(`/dashboard/${perfil}/alterar-plano`);
      await expect(
        page.getByText(
          "Controle financeiro: organize receitas e despesas, acompanhe pagamentos e saiba o que ainda falta receber.",
          { exact: true },
        ),
      ).toBeVisible();
      await print(page, `${perfil}-positivo-escolha-plano`);
    });

    test("rejeita dados inválidos, concorrência, correção abaixo do pago e preserva histórico", async ({
      request,
    }) => {
      for (const patch of [
        { valorCentavos: -1 },
        { valorCentavos: 1.5 },
        { vencimento: "2026-02-31" },
        { descricao: "" },
        { tipo: "saldo" },
      ]) {
        expect(
          (
            await request.post("/api/financeiro", { data: dados(patch) })
          ).status(),
        ).toBe(422);
      }
      const item = await criar(request, {
        descricao: "Teste de concorrência",
        valorCentavos: 30000,
      });
      expect(
        (await request.post("/api/financeiro", { data: item })).status(),
      ).toBe(201);
      expect(
        (
          await request.post("/api/financeiro", {
            data: { ...item, valorCentavos: 100 },
          })
        ).status(),
      ).toBe(409);
      const key = randomUUID();
      const [a, b] = await Promise.all([
        pagar(request, item, 20000, { id: key }),
        pagar(request, item, 20000, { id: randomUUID() }),
      ]);
      expect([a.status(), b.status()].sort()).toEqual([200, 409]);
      let atual = await (
        await request.get(`/api/financeiro/${item.id}`)
      ).json();
      expect(atual.pagoCentavos).toBe(20000);
      expect(atual.baixas).toHaveLength(1);
      const repetida = await pagar(request, item, 20000, {
        id: atual.baixas[0].id,
      });
      expect(repetida.status()).toBe(200);
      expect(
        (await pagar(request, atual, 100, { id: atual.baixas[0].id })).status(),
      ).toBe(409);
      expect(
        (await pagar(request, atual, 10000, { data: "2099-12-31" })).status(),
      ).toBe(422);
      expect(
        (
          await request.patch(`/api/financeiro/${item.id}`, {
            data: {
              ...dados(),
              acao: "editar",
              versao: atual.versao,
              valorCentavos: 10000,
              motivo: "Correção inválida",
            },
          })
        ).status(),
      ).toBe(409);
      expect(
        (
          await request.patch(`/api/financeiro/${item.id}`, {
            data: {
              acao: "cancelar",
              versao: atual.versao,
              motivo: "Tem baixa",
            },
          })
        ).status(),
      ).toBe(409);
      const reversao = await request.patch(`/api/financeiro/${item.id}`, {
        data: {
          acao: "desfazer",
          versao: atual.versao,
          baixaId: atual.baixas[0].id,
          motivo: "Baixa lançada por engano",
        },
      });
      expect(reversao.status()).toBe(200);
      atual = await reversao.json();
      const editar = await request.patch(`/api/financeiro/${item.id}`, {
        data: {
          ...dados(),
          acao: "editar",
          versao: atual.versao,
          valorCentavos: 25000,
          motivo: "Ajuste de honorários",
        },
      });
      expect(editar.status()).toBe(200);
      atual = await editar.json();
      expect(
        (
          await request.patch(`/api/financeiro/${item.id}`, {
            data: {
              acao: "cancelar",
              versao: atual.versao,
              motivo: "Lançamento em duplicidade",
            },
          })
        ).status(),
      ).toBe(200);
      const final = await (
        await request.get(`/api/financeiro/${item.id}`)
      ).json();
      expect(final.estado).toBe("cancelado");
      expect(final.pagoCentavos).toBe(0);
      expect(final.baixas[0].desfeita).toBe(1);
      expect(final.eventos.map((e: { acao: string }) => e.acao).sort()).toEqual(
        ["criado", "baixar", "editar", "desfazer", "cancelar"].sort(),
      );
      expect((await pagar(request, final, 100)).status()).toBe(409);
    });

    test("vincula agenda uma única vez e nega lançamento alheio ou atendimento de outro dono", async ({
      browser,
      request,
    }) => {
      const dono = await dadosDono(perfil);
      const [vet] = await consultar<{ id: string }>(
        "select id from veterinarios where user_id=(select id from users where email=$1)",
        [CONTAS.veterinario.email],
      );
      const [pet] = await consultar<{ id: string; tutor_id: string }>(
        "select id,tutor_id from pets where tutor_id is not null limit 1",
      );
      const id = randomUUID();
      agendas.push(id);
      await consultar(
        `insert into agendamentos (id,tutor_id,pet_id,veterinario_id,clinica_id,data_consulta,horario_consulta,status,tipo_consulta,preco_consulta) values ($1,$2,$3,$4,$5,$6,'10:00','realizado','presencial',300)`,
        [
          id,
          pet.tutor_id,
          pet.id,
          vet.id,
          perfil === "clinica" ? dono.id : null,
          hoje,
        ],
      );
      const item = await criar(request, {
        agendamentoId: id,
        descricao: "Atendimento vinculado à Lince",
      });
      expect(item.pagoCentavos).toBe(0);
      expect(
        (
          await request.post("/api/financeiro", {
            data: dados({ agendamentoId: id }),
          })
        ).status(),
      ).toBe(409);
      const externo = await browser.newContext({
        storageState: sessao(perfil === "clinica" ? "veterinario2" : "clinica"),
      });
      const outroPerfil: Perfil =
        perfil === "clinica" ? "veterinario" : "clinica";
      // Para a segunda conta de vet usa SQL próprio; não altera o dono do teste.
      const tabela = outroPerfil === "clinica" ? "clinicas" : "veterinarios";
      const email =
        perfil === "clinica" ? CONTAS.veterinario2.email : CONTAS.clinica.email;
      const [old] = await consultar<{ subscription_plan_code: string }>(
        `select subscription_plan_code from ${tabela} where user_id=(select id from users where email=$1)`,
        [email],
      );
      await consultar(
        `update ${tabela} set subscription_plan_code=$1 where user_id=(select id from users where email=$2)`,
        [outroPerfil === "clinica" ? "clinic_pro" : "vet_pro", email],
      );
      try {
        expect(
          (await externo.request.get(`/api/financeiro/${item.id}`)).status(),
        ).toBe(404);
        expect(
          (
            await externo.request.patch(`/api/financeiro/${item.id}`, {
              data: { acao: "cancelar", versao: 1, motivo: "Não é meu" },
            })
          ).status(),
        ).toBe(404);
        expect(
          (
            await externo.request.post("/api/financeiro", {
              data: dados({ agendamentoId: id }),
            })
          ).status(),
        ).toBe(404);
        const lista = await (
          await externo.request.get(`/api/financeiro?mes=${mes}`)
        ).json();
        expect(lista.itens.some((i: { id: string }) => i.id === item.id)).toBe(
          false,
        );
        expect(
          await (
            await externo.request.get(`/api/financeiro/exportar?mes=${mes}`)
          ).text(),
        ).not.toContain(item.id);
      } finally {
        await externo.close();
        await consultar(
          `update ${tabela} set subscription_plan_code=$1 where user_id=(select id from users where email=$2)`,
          [old.subscription_plan_code, email],
        );
      }
    });

    test("separa mês de vencimento e de recebimento; filtra e pagina sem perder registros", async ({
      request,
    }) => {
      const antigo = `${Number(hoje.slice(0, 4)) - 1}-01-15`;
      const antes = await (
        await request.get(`/api/financeiro?mes=${mes}`)
      ).json();
      const velho = await criar(request, {
        descricao: "Receita de período anterior",
        vencimento: antigo,
        valorCentavos: 12345,
      });
      expect((await pagar(request, velho, 12345)).status()).toBe(200);
      const depois = await (
        await request.get(`/api/financeiro?mes=${mes}`)
      ).json();
      expect(depois.resumo.recebido - antes.resumo.recebido).toBe(12345);
      expect(depois.resumo.aReceber).toBe(antes.resumo.aReceber);
      expect(depois.itens.some((i: { id: string }) => i.id === velho.id)).toBe(
        false,
      );
      const termo = `Paginação-${randomUUID().slice(0, 6)}`;
      for (let n = 0; n < 21; n++)
        await criar(request, {
          descricao: `${termo} ${n}`,
          valorCentavos: 100,
        });
      const primeira = await (
        await request.get(`/api/financeiro?mes=${mes}&busca=${termo}&pagina=1`)
      ).json();
      const segunda = await (
        await request.get(`/api/financeiro?mes=${mes}&busca=${termo}&pagina=2`)
      ).json();
      expect(primeira.total).toBe(21);
      expect(primeira.itens).toHaveLength(20);
      expect(segunda.itens).toHaveLength(1);
      expect(
        new Set(
          [...primeira.itens, ...segunda.itens].map(
            (i: { id: string }) => i.id,
          ),
        ).size,
      ).toBe(21);
      expect(
        (
          await (
            await request.get(
              `/api/financeiro?mes=${mes}&busca=${termo}&tipo=despesa`,
            )
          ).json()
        ).total,
      ).toBe(0);
      for (const query of [
        "mes=2026-13",
        "situacao=invalido",
        "pagina=-1",
        "tipo=outro",
      ])
        expect((await request.get(`/api/financeiro?${query}`)).status()).toBe(
          422,
        );
    });

    test("plano inferior bloqueia escrita e mantém consulta e exportação", async ({
      page,
    }) => {
      const item = await criar(page.request, {
        descricao: "Histórico preservado após troca de plano",
      });
      await plano(perfil, perfil === "clinica" ? "clinic" : "free");
      try {
        expect(
          (
            await page.request.post("/api/financeiro", { data: dados() })
          ).status(),
        ).toBe(403);
        expect((await pagar(page.request, item, 100)).status()).toBe(403);
        expect(
          (await page.request.get(`/api/financeiro/${item.id}`)).status(),
        ).toBe(200);
        expect(
          (
            await page.request.get(`/api/financeiro/exportar?mes=${mes}`)
          ).status(),
        ).toBe(200);
        await page.goto(`/dashboard/${perfil}/financeiro`);
        await expect(
          page.getByText("Histórico em modo de consulta"),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Novo lançamento", exact: true }),
        ).toHaveCount(0);
        await print(page, `${perfil}-negativo-plano-sem-acesso`);
      } finally {
        await plano(perfil, perfil === "clinica" ? "clinic_pro" : "vet_pro");
      }
    });
  });
}

test("financeiro: visitante, tutor e prestador não acessam dados nem exportação", async ({
  browser,
}) => {
  for (const perfil of [null, "tutor", "prestador"] as const) {
    const ctx = await browser.newContext({
      storageState: perfil ? sessao(perfil) : { cookies: [], origins: [] },
    });
    try {
      for (const rota of [
        "/api/financeiro",
        "/api/financeiro/exportar",
        "/api/financeiro/atendimentos",
        `/api/financeiro/${randomUUID()}`,
      ])
        expect((await ctx.request.get(rota)).status()).toBe(perfil ? 403 : 401);
      expect(
        (await ctx.request.post("/api/financeiro", { data: dados() })).status(),
      ).toBe(perfil ? 403 : 401);
    } finally {
      await ctx.close();
    }
  }
});
