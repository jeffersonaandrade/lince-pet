# Planos e migração no Supabase — 24/10/2026

**Atualização posterior:** o default legado do veterinário foi corrigido para `none` pela migração `20261024200000_veterinario_plano_padrao_none`, sem alterar os planos existentes. O diagnóstico abaixo preserva o estado anterior à correção.

Consulta e migração pelo MCP oficial autenticado com OAuth, limitado ao projeto `prezaxlfnpzirpbaodns`. O servidor `supabase` do Codex foi atualizado para esse destino por solicitação do usuário. A configuração anterior apontava a outro projeto.

## Como identificar o plano

O acesso usado pelo sistema está em `subscription_plan_code`, nas tabelas `veterinarios`, `clinicas` e `prestadores`. O catálogo está em `subscription_plans`. A tabela `subscriptions` registra recorrência, status, período e teste grátis; não substitui o campo de acesso para contas legadas de cortesia.

| Perfil | Códigos atuais |
| --- | --- |
| Veterinário | `none`, `vet_starter`, `vet_pro` |
| Clínica | `none`, `starter`, `clinic`, `clinic_pro` |
| Prestador | `free`, `pro` |

Veterinários legados podem ter `pro` ou `pro_plus`: o código `pro` equivale ao nível Starter nas verificações existentes; `pro_plus` equivale ao nível superior. Portanto, filtrar todo mundo por `pro` é incorreto. `vet_pro` é o código atual do Vet Pro. Clínicas usam sua própria nomenclatura; `clinic` é o plano Média.

Ter acesso a um plano não comprova pagamento. `active` também pode ser teste grátis: conferir `trial_end`. Pagamento confirmado exige evidência própria, como webhook financeiro válido; liquidação e situação financeira atual precisam de conciliação com o provedor. Ausência de webhook no banco não prova que nunca houve pagamento externo.

## Situação observada

| Perfil | Código | Quantidade | Situação no banco |
| --- | --- | --- | --- |
| Veterinário | `pro` legado | 1 | Sem registro em `subscriptions`; cortesia prevista no Graphify |
| Clínica | `clinic` | 1 | Sem registro em `subscriptions`; cortesia prevista no Graphify |
| Prestador | `pro` | 1 | Assinatura `active`, teste até 05/11/2026, sem eventos de pagamento confirmado encontrados |
| Prestador | `free` | 1 | Gratuito, sem assinatura |

Não foram encontrados veterinários com `vet_pro` nem clínicas com `clinic_pro`. A consulta não encontrou comprovação de pagamento das contas acima. Nenhum plano de usuário foi alterado.

Consulta simples de acesso, sem dados pessoais:

```sql
SELECT 'veterinario' AS tipo, id, subscription_plan_code AS plano
FROM public.veterinarios
UNION ALL
SELECT 'clinica', id, subscription_plan_code FROM public.clinicas
UNION ALL
SELECT 'prestador', id, subscription_plan_code FROM public.prestadores;
```

**Ponto de atenção:** o default de `veterinarios.subscription_plan_code` no banco ainda é `pro` legado; o cadastro normal define `none` explicitamente. Inserções externas que omitam esse campo podem conceder acesso indevido. Esse default não foi alterado nesta intervenção. As cortesias existentes devem ser preservadas, conforme Graphify.

## Migração aplicada

Única migração pendente: `20261024180000_asaas_cancelamentos`. As 12 migrações anteriores foram conferidas por nome, conclusão e checksum, aceitando diferenças de fim de linha.

- MCP `apply_migration`: `asaas_cancelamentos`, versão Supabase `20261024212833`.
- Criados tabela, chave primária, FK para `subscriptions` com `ON DELETE CASCADE`, índice de conciliação e RLS habilitado.
- DDL e registro em `_prisma_migrations` executados atomicamente. O histórico do Prisma foi registrado com checksum SHA-256 do arquivo versionado em LF: `dacaeb4ac12e1ac985961eef8061e498b8c644a083b55952d3c64be6380f930a`.
- Verificação posterior confirmou estrutura, RLS, índice, FK, registros nos dois históricos e fila vazia. Contagens por perfil/plano permaneceram iguais.
- Não foram executadas cobranças nem mudanças de plano. Esta migração prepara a persistência de cancelamentos; não comprova deploy da aplicação nem configuração de webhook/cron.

Evidências locais em `reports/supabase-migration-verified.json` e consultas associadas, ignoradas pelo Git. Dados pessoais, tokens OAuth e credenciais não foram incluídos neste documento.
