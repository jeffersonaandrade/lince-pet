# Homologação Asaas — 24/10/2026

**Veredito: NÃO RECOMENDADO para produção neste momento. O ciclo de pagamento funciona no sandbox, mas a falha de cancelamento remoto impede aprovar a cobrança recorrente.**

## Ambiente e método

- Credenciais de sandbox do `.env`, banco exclusivamente local (`127.0.0.1:5433`). Nenhum valor real movimentado.
- MCP oficial `https://docs.asaas.com/mcp`: consulta de schemas e execução autenticada das operações de teste. API canônica `https://api-sandbox.asaas.com/v3` e URL legada configurada no projeto responderam à autenticação.
- Aplicação compilada com `npm run build` e executada em modo de produção local, com `ASAAS_ENV=sandbox`.
- Cadastros, onboarding do prestador e contratação/troca de plano feitos pela interface. Conferência de estado no banco local. Cancelamento exercitado pelo endpoint, pois a interface atual não apresenta esse comando.
- Webhook temporário, autenticado, com entrega real do Asaas ao endpoint atual `/api/webhooks/asaas`. O túnel expôs apenas um proxy de webhook com caminho aleatório, token obrigatório e limite de corpo; não expôs o restante do site.
- Clientes fictícios `lincepet-qa-*`, notificações desabilitadas no Asaas. E-mail e WhatsApp da aplicação em driver `log`.
- Simulações de Pix/boleto pelo endpoint de confirmação de sandbox; cartão aprovado/recusado pelo endpoint de pagamento com cartão, usando dados fictícios da documentação. Isso não testa adquirentes ou instituições financeiras reais.

## Defeito corrigido

O valor da chave no `.env` tinha **duas barras de escape antes do `$`**. `AsaasService` tratava apenas uma, enviava uma chave inválida e recebia `401 invalid_access_token`.

A normalização agora remove as barras de escape iniciais antes do `$`, preservando o restante da chave. A mesma credencial, normalizada, autenticou tanto por HTTP direto como pelo MCP. Um teste de regressão cobre o caso. Não foram gravadas chaves no repositório nem alteradas as credenciais do `.env`.

## Fluxos aprovados

| Perfil | Primeira assinatura / teste | Contratação posterior | Cobrança confirmada |
| --- | --- | --- | --- |
| Veterinário | `vet_starter`, R$ 39,90, primeira fatura em 07/11/2026 | `vet_pro`, R$ 59,90 | `pay_u8ciue5gyg7zxhy3` |
| Clínica / laboratório | `starter`, R$ 99,90, primeira fatura em 07/11/2026 | `clinic`, R$ 149,90 | `pay_77bvnx15pxkipvgx` |
| Profissional pet | `pro`, R$ 59,00, primeira fatura em 07/11/2026 | `pro`, R$ 59,00, após cancelar o teste | `pay_tutunepzcjm846zt` |

Para os três perfis, foram conferidos:

1. Conta criada pela interface e cliente correspondente criado no Asaas sandbox.
2. Assinatura mensal, valor consistente com `subscription_plans.price_cents / 100`, fatura inicial com `billingType=UNDEFINED`.
3. Primeiro teste de 14 dias libera o plano e agenda a primeira fatura para o fim do teste.
4. Contratação posterior não concede outro teste: fica `pending`, com link de fatura e sem liberar o novo plano antecipadamente.
5. Evento **real** `PAYMENT_RECEIVED` recebido do Asaas: assinatura ativa e plano correto aplicado no banco local.
6. Na troca de veterinário e clínica, assinatura anterior cancelada também no Asaas após confirmar a nova.
7. Reenvio do mesmo evento duas vezes responde 200, mantém uma única linha de `webhook_events` e não muda novamente o plano.
8. Token inválido no endpoint atual é recusado com 401.
9. Cancelamento normal encerra localmente, retorna ao plano padrão e deixa a assinatura remota `INACTIVE`, `deleted=true`.

`nextDueDate` da assinatura remota pode avançar após gerar a cobrança inicial. O vencimento validado acima é o da **primeira cobrança**, não uma suposição sobre aquele campo após a geração.

## Meios de pagamento e eventos posteriores

| Cenário | Resultado observado | Cobrança sandbox |
| --- | --- | --- |
| Boleto | Linha digitável de 47 dígitos; plano bloqueado antes de pagar | `pay_ax5irrbix5pmkx6q` |
| Vencimento do boleto | Simulação oficial emitiu `PAYMENT_OVERDUE`; assinatura virou `past_due` | mesma cobrança |
| Pagamento após vencimento | `PAYMENT_RECEIVED` real ativou `vet_starter` | mesma cobrança |
| Pix | QR Code e copia e cola gerados; confirmação simulada emitiu webhook real e ativou o plano | `pay_3xyly5kv4hwtyeck` |
| Cartão recusado | Retorno de erro; assinatura permaneceu `pending`, dono no plano `none` | `pay_iwgq25gah3i3uydl` |
| Cartão aprovado | Cartão fictício aprovado, status `CONFIRMED`; `PAYMENT_CONFIRMED` real ativou o plano | mesma cobrança |
| Estorno do cartão | Asaas retornou `REFUNDED`; evento real suspendeu o plano e marcou `past_due` | mesma cobrança |

A interface do site redirecionou para a fatura do Asaas. Os meios e resultados financeiros foram exercitados pela API de sandbox via MCP; não foi homologado o preenchimento completo de cada formulário da fatura hospedada no navegador.

## Bloqueador confirmado: cancelamento pode informar sucesso sem cancelar no Asaas

**Prioridade P1.** Foi criada pela interface uma assinatura descartável e o cancelamento foi chamado contra uma segunda instância local com chave de Asaas deliberadamente inválida. A consulta posterior ao Asaas usou a credencial válida.

| Evidência | Resultado |
| --- | --- |
| Assinatura remota | `sub_41y77sisdrui7caa` |
| Recusa do Asaas ao tentar cancelar | HTTP 401 |
| Resposta do site ao usuário | HTTP 200, `Assinatura cancelada com sucesso` |
| Estado local | `canceled` |
| Estado remoto verificado com chave válida | `ACTIVE`, `deleted=false` |

O teste confirmou uma divergência real no sandbox. Ao final, a assinatura foi cancelada diretamente pelo MCP com a chave válida para não deixar recorrência aberta.

**Risco técnico e comercial:** o usuário pode receber confirmação de cancelamento enquanto a recorrência continua ativa no provedor. Isso pode manter cobranças futuras e gerar atendimento, contestação e perda de confiança.

**Causa:** `cancelarAssinaturas` em `src/server/services/assinaturas.ts` captura o erro remoto e continua o cancelamento local. Os testes existentes inclusive aceitam esse comportamento. Há padrão semelhante ao cancelar assinaturas antigas/pendentes durante troca de plano (`assinaturas.ts` e `asaas-webhook.ts`); nesses dois caminhos o risco foi identificado no código, sem injeção de falha remota nesta rodada.

**Correção necessária antes de produção:** distinguir cancelamento solicitado, confirmado e falho; persistir/reconciliar as tentativas no provedor e nunca apresentar confirmação definitiva sem evidência remota. Uma indisponibilidade não pode apagar a necessidade de cancelar a recorrência. Esta correção de fluxo não foi implementada nesta homologação.

## Outras pendências

- **Credencial em log de erro:** na injeção de falha, o `console.error` do cancelamento incluiu o objeto Axios com o header `access_token` e a chave deliberadamente inválida. Isso confirma que esse caminho pode registrar uma chave válida se uma falha ocorrer com ela. Sanitizar o erro antes do log; os artefatos brutos de diagnóstico não devem ser compartilhados.
- **Cancelamento na interface:** `cancelarAssinatura()` existe no cliente de API, mas não foi encontrada chamada nos componentes ou páginas dos painéis. Os cancelamentos aprovados nesta rodada foram pela API, não por um botão disponível ao assinante.
- **Retomada de pagamento pelo profissional pet:** `CardPlano` mostra pagamento em processamento quando está pendente, mas não apresenta o `checkoutUrl` para reabrir a fatura. A recuperação depois de fechar a fatura precisa de ajuste.
- **Configuração persistente do sandbox:** havia um único webhook antigo, desativado/interrompido, apontando para `https://lince-pet-backend-production.up.railway.app/webhooks/asaas`. Ele foi preservado. O webhook temporário criado nesta rodada não substitui a configuração definitiva.
- **Token:** `ASAAS_WEBHOOK_TOKEN` não estava presente no `.env` local. O teste usou um token aleatório por processo, compartilhado com o webhook temporário. Em produção, é obrigatório configurar o mesmo segredo no app e no Asaas; não é possível inferir as variáveis do deploy a partir deste `.env`.
- **Credenciais de produção:** não foram usadas nem verificadas. Aprovação, liquidação, antifraude, contestação/chargeback real e indisponibilidade prolongada não estão homologados por estes testes.
- **Escopo:** pagamentos homologados são as assinaturas da plataforma. Exames continuam com pagamento na clínica, conforme o Graphify; os métodos de Pix para tutor existentes no serviço não possuem chamadas em outros arquivos de `src` nesta revisão.

## Verificações locais

- 180 testes unitários aprovados em `assinatura-regras`, `assinaturas`, `assinatura-rotas`, `asaas-webhook`, `cobertura/asaas` e `cobertura/assinaturas`.
- `npm run build`: aprovado. Permanecem 45 avisos de lint e três avisos do Turbopack sobre acesso dinâmico ao sistema de arquivos em `notifications.ts`, sem alteração desses arquivos nesta rodada.
- Testes de sucesso não anulam o defeito de cancelamento acima; o resultado global não equivale a aprovação para produção.
- Evidências operacionais locais, com dados de teste: `reports/asaas-sandbox-results-*.json`, `reports/asaas-metodos-results.json`, `reports/asaas-cancel-failure-results.json`. Os arquivos de sessão/segredos temporários em `reports` são ignorados pelo Git e não devem ser compartilhados.
- Limpeza confirmada por consulta individual de 11 assinaturas criadas nesta rodada: nenhuma ficou ativa no Asaas. O webhook temporário foi removido; sobrou apenas o webhook antigo, que permaneceu desativado. Registros financeiros fictícios foram mantidos no sandbox para rastreabilidade.

## Próximo passo recomendado

Corrigir a confirmação/reconciliação do cancelamento e expor cancelamento e retomada de fatura na interface. Depois repetir a falha remota, verificar a configuração definitiva de webhook e credenciais no ambiente de destino e somente então aprovar uma entrada controlada em produção.

## Referências oficiais consultadas pelo MCP

- [MCP do Asaas](https://docs.asaas.com/docs/mcp-1).
- [Sandbox e limitações](https://docs.asaas.com/docs/sandbox).
- [Confirmação simulada de pagamento](https://docs.asaas.com/reference/confirmar-pagamento).
- [Cartão de crédito no sandbox](https://docs.asaas.com/docs/testando-pagamento-com-cart%C3%A3o-de-cr%C3%A9dito).
