# Uso de dados no painel admin

O menu **Admin → Uso de dados** (`/admin/uso`) mostra o espaço ocupado pelo banco e pelos arquivos, para antecipar a decisão entre ampliar o plano ou planejar uma migração. A aba fica ao lado de **Aprovações**.

## Leituras e alertas

- **Banco:** tamanho do banco conectado, incluindo dados e índices de todos os seus schemas. Isso inclui `evolution` se o WhatsApp compartilhar o mesmo banco. Não é uma leitura de todo o disco/cluster Supabase.
- **Tabelas:** até 15 maiores tabelas, com espaço e estimativa de registros. `n_live_tup` é uma estatística do PostgreSQL; uma tabela nova ou sem análise recente pode mostrar estimativa zero mesmo contendo registros. Não usamos contagens completas de todas as tabelas a cada acesso.
- **Storage:** soma do campo de tamanho dos metadados dos arquivos de todos os buckets do projeto, incluindo fotos e laudos. Não baixa arquivos nem expõe nomes de objetos, documentos ou conteúdo.
- **Falhas:** fonte indisponível ou inexistente fica explicitamente sem medição. Objetos sem tamanho válido tornam o total parcial; não são apresentados como armazenamento livre.
- **Alertas:** abaixo de 70%, dentro da referência; de 70% a 90%, planejar ampliação; de 90% a 100%, priorizar; a partir de 100%, referência atingida. Percentuais acima de 100 continuam visíveis.

As referências padrão são **500 MB para o banco e 1 GB para arquivos**, conforme a [página de preços do Supabase](https://supabase.com/pricing), consultada em 23/10/2026. No aplicativo essas unidades são decimais (MB = 1.000.000 B; GB = 1.000.000.000 B). Elas orientam os avisos e não representam um medidor oficial de cobrança nem confirmam o plano contratado.

Após mudança de plano ou de provedor, configure no servidor:

```dotenv
ADMIN_CAPACIDADE_BANCO_MB=500
ADMIN_CAPACIDADE_STORAGE_GB=1
```

São valores positivos. Alterar essas referências não contrata plano nem aumenta espaço. O painel sempre identifica que as referências são configuradas. O uso da organização pode incluir outros projetos; o [consumo oficial do Storage](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size) considera o período de cobrança, enquanto este painel mostra uma leitura atual dos metadados do projeto.

Sem histórico de crescimento, não há previsão de “dias restantes”. Transferência mensal, WAL, CPU e conexões não são medidos. Estar abaixo do limite de espaço não garante capacidade operacional nem disponibilidade do serviço. Uma migração também exige planejamento de backup, restauração e transferência dos arquivos; não se recomenda apagar prontuários apenas para liberar espaço.

## Implementação

Página e endpoint usam o mesmo `requireAdmin` existente; o frontend não recebe chave Supabase nem conexão de banco. A consulta usa Prisma no backend, com SQL fixo e somente metadados. Cada fonte roda em transação somente leitura, com timeout de consulta de 3 s e de transação de 8 s. Falhas retornam estado genérico, sem mensagem interna do banco.

O backend deduplica consultas simultâneas e mantém cache por instância de até 60 s; leituras com falha são retentáveis após 5 s. **Atualizar leitura** respeita esse cache. O timestamp identifica quando os valores foram obtidos, inclusive se uma atualização falhar e a interface preservar a leitura anterior. O endpoint usa `Cache-Control: private, no-store` e revalida a autorização antes de acessar o cache interno.

Não há migrations, gravação de histórico, limpeza automática, alteração de plano, exclusão de dados ou chamadas à API de gerenciamento do Supabase. O monitor só coleta quando o admin solicita a leitura; ele não envia alertas por e-mail em segundo plano.

## Verificação funcional

Resultado desta entrega: **18 testes unitários/API e 7 testes funcionais no Chromium aprovados**, TypeScript sem erros e ESLint sem erros/avisos nos arquivos desta funcionalidade. Não foi executado build de produção completo. As primeiras tentativas do E2E revelaram o problema de navegação sem sessão; a autorização da página foi movida para o servidor antes da rodada final aprovada.

- Testes unitários/API em `tests/server/admin-capacidade*.test.ts`: limites dos avisos, serialização de BigInt, cache, concorrência de leitura, fonte indisponível, Storage ausente, metadados incompletos e proteção 401/403.
- E2E em `e2e/admin-uso.spec.ts`: visitante, tutor, navegação do admin com consulta real ao banco, atualização, avisos 70%/90%/105% e apresentação de falha. Os cenários de limiar e falha simulam a resposta da API no navegador; a navegação principal usa a API e o banco reais.
- Ambiente funcional desta entrega: cópia do código sem `.env`, processo com variáveis explicitamente fictícias, Postgres 16 descartável na porta local 55439, duas contas fictícias e schema `storage.objects` sintético. Não foram consultados dados de produção nem usados buckets reais. O Storage no teste verifica a agregação de metadados, não a infraestrutura de arquivos do Supabase.

Para reproduzir no ambiente e2e local usual: `npx playwright test e2e/admin-uso.spec.ts`. O setup existente exige o banco local e prepara a conta admin. Para unitários: `npx vitest run tests/server/admin-capacidade.test.ts tests/server/admin-capacidade-rota.test.ts`.
