# Correção do cancelamento Asaas — 24/10/2026

Regressão do bloqueador identificado na [homologação](HOMOLOGACAO-ASAAS-2026-10-24.md). Operações externas exclusivamente no sandbox, com usuários fictícios e PostgreSQL local; nenhuma cobrança de produção foi utilizada.

## Comportamento corrigido

- Pedido persistido em `asaas_cancelamentos` antes da comunicação externa. HTTP 202 significa pendência; HTTP 200 significa confirmação. Falha não remove o plano nem apaga a obrigação de cancelar.
- Consulta antes do DELETE permite conciliar exclusão aceita cuja resposta se perdeu. Só evidência remota da assinatura correta ou webhook autenticado de encerramento permitem marcar `canceled`. HTTP 404 isolado não comprova cancelamento.
- Lease de dois minutos, backoff de um minuto até uma hora, três trabalhos por execução. Worker e webhook finalizam sob lock do assinante, preservando o plano novo quando há outra assinatura ativa.
- Webhook de troca enfileira o cancelamento antigo sem HTTP dentro da transação. Estado `cancel_pending` explicita a obrigação; nova contratação/troca bloqueada enquanto houver pendência.
- Cancelamento nos painéis de veterinário, clínica e prestador, com confirmação do usuário, atualização periódica e retomada da mesma fatura aberta. Fatura em encerramento não é oferecida para pagamento.
- Logs Asaas permitem códigos controlados e identificador interno; descartam erro Axios, headers, credenciais, mensagens arbitrárias e corpos do provedor.

## Evidências de regressão

| Cenário | Resultado |
| --- | --- |
| Fatura pendente do veterinário e do prestador | Link disponível na interface para a fatura existente |
| Pagamento pelo MCP do sandbox | Webhook real ativou o plano antes do cancelamento |
| Credencial inválida no cancelamento | Asaas HTTP 401; site HTTP 202, assinatura local/remota ativas, plano preservado |
| Interface após HTTP 401 | “Cancelamento em confirmação”, sem confirmação falsa nem fatura para pagar |
| Pedido após falha | Persistido com `HTTP_401`, tentativas/próximo horário; nova contratação recusada com 409 |
| Cron sem autenticação | HTTP 401 |
| Cron com segredo e credencial válida | Recorrência removida; local cancelado; tela atualizou sem recarregar |
| Logs da falha real | Não continham a chave inválida nem `access_token` |
| Cancelamento pelo prestador | Recorrência removida e plano restaurado para `free` |
| Upgrade com webhook real | Antiga cancelada pela fila, plano novo preservado |
| Seis crons concorrentes no PostgreSQL local | Uma única tentativa adquirida e concluída |

Evidências locais ignoradas pelo Git: `reports/cancelamentos-regressao-results.json`, `reports/cancelamentos-upgrade-results.json` e screenshots de pendência/confirmação. Sessões, tokens e logs brutos de rodadas anteriores não devem ser compartilhados.

## Verificações

- 199 testes direcionados aprovados: confirmação, resposta incompleta, timeout, HTTP 401/404/429/500, exclusão já aceita, preservação do plano novo, defaults dos três tipos, lease, backoff, logs seguros e API.
- TypeScript sem erros e build aprovado; permanecem 45 avisos de lint e três avisos do Turbopack sobre acesso dinâmico ao sistema de arquivos em notificações, anteriores a esta alteração.
- Suíte completa: 1.418 aprovados, dois testes de autenticação Google falharam com `TypeError: fn is not a function` no hook de preparação de `tests/server/cobertura/auth.test.ts`; arquivos de autenticação não foram modificados neste trabalho. Os 41 testes de contrato dependentes de ambiente ficaram ignorados. Esta execução antecedeu os últimos testes adicionais de rota; o conjunto direcionado final acima inclui esses testes.

## Implantação e limites

1. Aplicar a migração `20261024180000_asaas_cancelamentos` junto ao deploy. O fluxo de inicialização já executa as migrações; nesta rodada ela foi aplicada somente ao banco local.
2. Garantir ambiente/chave do Asaas, `ASAAS_WEBHOOK_TOKEN` e `CRON_SECRET` no serviço existente. O token deve coincidir com o webhook do Asaas. Não é necessário criar outro serviço Render.
3. Manter o cron autenticado existente de `/api/cron/lembretes-whatsapp`, que agora também drena a fila. Opcionalmente usar `/api/cron/assinaturas` para execução dedicada. Polling da interface não executa o worker.
4. Validar evento real e cron no ambiente de destino. O webhook temporário local não substitui a configuração definitiva do deploy.
5. Falhas persistentes exigem intervenção. A recorrência remota ainda pode cobrar enquanto o cancelamento não foi confirmado. Não há estorno automático.

Sandbox não comprova liquidação, antifraude ou configuração de produção. Commit/push não comprovam que migração e deploy terminaram.

Limpeza confirmada por consulta individual: as quatro assinaturas criadas nesta regressão estão excluídas no Asaas. O webhook temporário foi removido; o webhook legado permaneceu preservado.
