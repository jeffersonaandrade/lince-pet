# Controle financeiro — Vet Pro e Clínica Grande

## Escopo

Controle gerencial de receitas, despesas, honorários e pagamentos manuais. Escrita disponível no `vet_pro` do veterinário e no `clinic_pro` da clínica. A clínica controla seus próprios valores; participar da equipe não dá acesso ao financeiro do estabelecimento. Dados separados por usuário e perfil, sem repasse automático.

- Rotas: `/dashboard/veterinario/financeiro` e `/dashboard/clinica/financeiro`, acessíveis pelo painel e pelo menu da conta.
- Resumo: recebido e pago no mês pela data da baixa; a receber, a pagar e receitas vencidas pelo mês de vencimento. Resultado de caixa = recebido menos despesas pagas.
- Lançamentos manuais de atendimentos da Lince ou externos; categorias e pagadores/favorecidos livres; baixas integrais/parciais com data e forma de pagamento.
- Correção de lançamento, desfazer baixa incorreta e cancelamento sem apagar histórico.
- Filtros de mês, tipo, situação e busca por descrição/categoria/contraparte; paginação de 20 registros.
- CSV dos lançamentos filtrados e suas baixas, inclusive as desfeitas. Limite explícito de 10.000 lançamentos por exportação, sem corte silencioso.
- Perda de plano: consulta, detalhes e exportação preservados; criação e alterações bloqueadas pelo servidor.
- Mensagem comercial nos cards de Vet Pro e Clínica Grande em preços, cadastro e troca de plano, sem “Em breve”.

## Regras

1. Atendimento não significa pagamento recebido. Vincular uma consulta gera previsão; a baixa é manual.
2. O vínculo com a agenda é opcional e escolhido pelo usuário. A seleção mostra até 100 atendimentos do mês selecionado. O profissional confirma seus honorários; a clínica informa o valor do estabelecimento. Não há cálculo automático de comissão.
3. Um atendimento só pode ser vinculado uma vez por usuário/perfil, inclusive após cancelamento do lançamento. Agendamentos cancelados ou recusados não podem gerar novos vínculos. Mudanças posteriores na agenda não alteram automaticamente o financeiro.
4. Pagamentos futuros são recusados. Valores são inteiros em centavos, de R$ 0,01 a R$ 9.999.999,99. Precisão maior que dois decimais é recusada.
5. Baixa não pode superar o saldo. Alterações concorrentes são serializadas por lançamento; a versão evita sobrescrever mudanças. IDs de requisição evitam duplicar lançamentos e baixas no reenvio.
6. Correção não pode reduzir o valor abaixo do já pago. Para cancelar lançamento com baixa é preciso desfazer a baixa, com motivo, antes. Isso não realiza reembolso nem cancela consulta ou cobrança externa.
7. Histórico mantém criação, valores anteriores/posteriores das correções, baixas, baixas desfeitas e motivos. Não existe endpoint de exclusão definitiva.
8. Pendências históricas representam o saldo ainda aberto hoje dos lançamentos com vencimento no período. Não são um balanço contábil retroativo. Recebimentos de dívidas antigas entram no mês efetivo do pagamento.

## Persistência e acesso

Migração Prisma `20261102210741_controle_financeiro`, com três tabelas: lançamentos, baixas e eventos. Constraints protegem valores, tipos e perfis; índice único impede dupla vinculação de atendimento. Alteração e auditoria são persistidas na mesma transação. Consultas e mutações validam o dono autenticado, sem confiar em `userId` enviado pelo cliente.

RLS habilitada nas três tabelas, sem políticas públicas e com privilégios revogados de PUBLIC/anon/authenticated. O backend usa a conexão PostgreSQL da aplicação e a autenticação JWT existente. O CSV neutraliza fórmulas de planilha.

## Cenários de homologação

Executados para veterinário e clínica, com frontend, API e PostgreSQL locais reais. Dados de demonstração; lançamentos criados são removidos e planos originais restaurados ao final.

| Tipo | Cenário | Resultado |
| --- | --- | --- |
| Positivo | Receita de R$ 300 criada pela tela; baixa de R$ 100 | Parcial; recebido R$ 100; pendente R$ 200 |
| Negativo | Pagar R$ 250 quando restam R$ 200 | Recusa sem baixa adicional |
| Positivo | Despesa e segunda receita quitadas | Resumo correto; recarga mantém dados |
| Positivo | Exportação pela tela e API | CSV contém lançamentos e baixas |
| Positivo | Histórico e escolha de plano | Conteúdo exibido, com prints |
| Positivo | Celular com largura de 390 px | Sem transbordamento da página; registros em cartões |
| Negativo | Valor negativo/fracionário, data impossível, descrição vazia e tipo inválido | HTTP 422 |
| Negativo | Duas baixas concorrentes de R$ 200 sobre R$ 300 | Um sucesso e um conflito; baixado R$ 200 |
| Positivo | Reenviar ID de baixa aceita | Não duplica pagamento |
| Negativo | Pagamento futuro, correção abaixo do pago e cancelar com baixa | Recusados |
| Positivo | Desfazer baixa, corrigir e cancelar | Eventos e baixa original preservados |
| Negativo | Alterar lançamento cancelado | HTTP 409 |
| Positivo | Vincular atendimento próprio | Previsão sem baixa automática |
| Negativo | Vincular novamente o mesmo atendimento | HTTP 409 |
| Negativo | Outro dono lê/altera/lista/exporta ou vincula atendimento alheio | Sem exposição; detalhes/mutações/vínculos retornam 404 |
| Positivo | Receber hoje dívida do ano anterior | Caixa aumenta no mês atual sem mudar pendências deste mês |
| Positivo | 21 lançamentos filtrados | Duas páginas; 21 IDs distintos |
| Negativo | Filtros inválidos | HTTP 422 |
| Negativo | Plano inferior tenta criar ou baixar | HTTP 403; consulta/exportação preservadas |
| Negativo | Visitante, tutor e prestador acessam API | HTTP 401/403 |

`npx playwright test e2e/financeiro.spec.ts --project=chromium`: **18 passaram**, sendo 11 cenários de financeiro e 7 preparações de sessão. DATABASE_URL e DIRECT_URL precisam apontar para PostgreSQL local na porta 5433. Regras puras em `tests/lib/financeiro.test.ts`: **6 passaram**. Suíte unitária completa: **1.711 passaram; 48 ignorados**, estes de contrato/integração que dependem de habilitação própria.

## Evidências

Prints locais em [evidencias/financeiro-2026-11-02](evidencias/financeiro-2026-11-02): painel, celular, histórico, escolha de plano, recusa de excesso de pagamento e restrição de plano, para os dois perfis. Os prints comprovam homologação local; não comprovam publicação.

## Limites

Sem emissão fiscal, contabilidade, banco, cobrança automática, movimentação de dinheiro, conciliação de cartão, estoque ou comissões automáticas. Resultado não é lucro líquido ou saldo bancário. A assinatura da Lince continua separada do financeiro dos atendimentos.

A decisão de 02/11/2026 substitui o adiamento integral registrado em 27/10/2026: este módulo básico entra agora; recursos avançados continuam fora da entrega.
