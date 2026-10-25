# Correções da auditoria — 23/10/2026

**Veredito: VIÁVEL COM RISCOS. A auditoria terminou; a remediação integral ainda não.**

**Atualização de 24/10/2026:** o dono escolheu as regras de consumo no aceite, início obrigatório por código, recuperação administrativa de CNPJ e arquivamento de pets. Foram implementadas e homologadas na [rodada de regras de negócio](HOMOLOGACAO-REGRAS-DE-NEGOCIO-2026-10-24.md), cobrindo os caminhos de NV-06, NV-10 e NV-14 e a exclusão de pet pela aplicação relacionada a NV-09. Arquivamento preserva o histórico; política/prazo de retenção e eliminação definitiva continuam exigindo validação dos responsáveis. A tabela abaixo preserva o registro histórico de 23/10, não o estado final dessas quatro áreas. As outras pendências não foram declaradas resolvidas nesta rodada.

Base: relatório externo `C:/Users/jeffe/security-audit-skill/lince-pet/run-1/REPORT.md`, sobre o commit `7dc801d`. A auditoria registrou 23 pistas `needs_validation` e nenhum finding confirmado. Este documento registra alterações no código e bloqueios restantes; não promove automaticamente as pistas a vulnerabilidades confirmadas nem declara produção segura.

As alterações de favoritos e redirecionamento já estavam no diretório de trabalho e foram preservadas e revisadas. Não houve acesso a valores de `.env`, banco de produção, Render, Asaas ou Supabase. Não foram executadas migrations nem alterados dados existentes.

## Rastreabilidade

| Item original | Tratamento nesta alteração | O que falta |
|---|---|---|
| NV-01 — pré-sequestro via Google | Ao comprovar e-mail ainda não verificado, substitui senha, incrementa versão da sessão e apaga resets anteriores em transação. | Validar callback OAuth completo com provedor simulado e orientar usuários sobre recuperação da senha local após o primeiro login Google. Não há vínculo persistente por `sub`. |
| NV-02 — redirecionamento | Recusa pathname que normaliza para `//host`; regressões incluem segmentos `..` e `%2e`. | Navegação real no browser em staging. |
| NV-03 — favoritos | Projeção explícita de nome, foto, cidade/estado e identificadores necessários; não carrega contatos, documentos ou endereço completo. | Integração Prisma/HTTP com dados fictícios. |
| NV-04 — seed demo | Opt-in `SEED_DEMO=true`; recusa produção mesmo com opt-in. Catálogo continua disponível sem contas demo. | Responsável deve verificar se já existem contas demo em produção e revogar/remover acessos seguindo procedimento aprovado. A trava não corrige contas antigas. |
| NV-05 — destino push arbitrário | Allowlist aplicada no cadastro e no envio de inscrições antigas; recusa IP, credenciais e portas alternativas. | Conferir provedores dos navegadores suportados em staging; ajustar allowlist se necessário. |
| NV-06 — reserva de CNPJ | Não alterado. | Definir prova de titularidade, prazo de reserva e recuperação de CNPJ; implementar o fluxo com esses requisitos. Não liberar nem transferir CNPJ automaticamente. |
| NV-07 — IP do rate limit | Não alterado. | Confirmar contrato do proxy sobre `X-Forwarded-For`; definir hops confiáveis e contador compartilhado entre instâncias. Trocar para o último IP sem conhecer o ingress também seria uma suposição insegura. |
| NV-08 — login CSRF | Login/logout recusam Origin divergente, `null` e `Sec-Fetch-Site: cross-site`, antes de alterar sessão. | Fluxo de browser em staging e origem pública configurada corretamente em `NEXT_PUBLIC_APP_URL`. |
| NV-09 — exclusão em cascata | Não alterado. | Definir retenção de prontuário, anonimização e exclusão lógica; validar requisitos jurídicos antes de prometer prazo de exclusão de registros clínicos. |
| NV-10 — concluir sem iniciar | Não alterado para consultas veterinárias. | Decidir se consultas antigas/externas podem ser concluídas sem código. Prestadores já exigem início. Aplicar a regra escolhida no backend e na interface. |
| NV-11 — tentativas do código | Lock transacional por agendamento no vet e no prestador. Tentativa inválida é commitada antes da resposta de erro. | Integração concorrente com Postgres real; o teste direcionado usa banco simulado com mutex. |
| NV-12 — aprovação de dados alterados | Fingerprint inclui CRMV/RT e timestamp; gravação condicional rejeita edição entre listagem, leitura e decisão. Interface envia a revisão exibida. | E2E do admin e integração com Postgres. Clientes antigos sem `revisao` precisam atualizar a lista/interface. |
| NV-13 — reiniciar cota trocando plano | Trocas/ativação de plano preservam o uso mensal por padrão. | Regressão completa de assinatura, webhook e renovação mensal com Asaas simulado; nenhum acesso ao Asaas real. |
| NV-14 — tutor consome cota de terceiro | Não alterado. | Definir quando reservar/consumir cota, limite de pedidos pendentes por tutor e recuperação após recusa. Corrigir também concorrência dos contadores, sem inventar uma nova regra de cobrança. |
| NV-15 — e-mail e maiúsculas | Não alterado no schema. | Responsável deve levantar duplicidades por `lower(email)`; resolver conflitos sem mesclar contas automaticamente; depois criar índice único funcional em migration. Não aplicar índice cegamente: duplicidades fariam a migration falhar e poderiam impedir o serviço de iniciar. |
| NV-16 — erro de banco exposto | Busca pública não devolve exceção; criação de agendamento e estatísticas do vet só incluem diagnóstico em desenvolvimento. | Testar erros reais com dados fictícios e verificar logs sem credenciais. |
| NV-17 — envio push sem limite | Timeout de 5 s, allowlist e fan-out limitado a 10 inscrições por chamada. | Biblioteca ainda acumula corpo da resposta sem teto explícito; validar limite de resposta e duração total do cron. Timeout por envio não é orçamento global do cron. |
| NV-18 — inscrições ilimitadas | Até 10 por usuário; verificação e upsert sob locks transacionais; renovar aparelho existente continua permitido. | Limpeza de inscrições antigas excedentes e integração concorrente. Transferência do mesmo endpoint entre usuários do aparelho foi preservada. |
| NV-19 — catálogo sem paginação | Não alterado. | Paginação no banco e na interface, agregação de avaliações no banco e limite de filtros. Não cortar silenciosamente listas porque isso esconderia profissionais do cliente. |
| NV-20 — JSON de horários grande | Recusa gravações acima de 10.000 caracteres antes de atualizar a clínica. | Validar estrutura de dias/faixas, limite do corpo antes do parse e saneamento de JSONs antigos. O limite desta alteração atua depois do parse. |
| NV-21 — experiências ilimitadas | Até 30 itens, local/cargo até 255 e descrição até 5.000 caracteres; valida antes de apagar; delete/create em transação com lock. | Saneamento de cardinalidades antigas e teste de integração concorrente. |
| NV-22 — sobreposição de prestador | Criação/remarcação usam a mesma chave de advisory lock e refazem consulta de ocupação dentro da transação. | Teste concorrente Postgres e avaliação de constraint de exclusão como defesa no banco; outras mudanças de status ainda merecem testes de corrida. |
| NV-23 — horário livre e corrida no vet | `HH:mm` estrito em criar/reagendar; lock compartilhado e rechecagem de ocupação, incluindo consultas em andamento. | Validar grade de trabalho no servidor, horários/duplicidades legados, corrida com bloqueios/cancelamentos e constraint de ocupação no banco. Não foi criada migration que pudesse falhar sobre dados não examinados. |

Hardening adicional: o service worker recusa navegação de notificações para outra origem; reset exige senha do tamanho mínimo, consumo único e invalidação de outros resets e sessões. Tokens de reset continuam armazenados no formato anterior; hashing em repouso exige uma alteração separada com compatibilidade para links já emitidos.

## Validação e limites

Foi possível usar a imagem Node 22 já instalada no Docker, sem instalar dependências. Execução em contêiner: rede externa desativada (`--network none`), ambiente iniciado com `env -i`, cópia do código sem `.env` nem `.git` somente leitura, dependências somente leitura, escrita apenas no tmpfs `/scratch` de 128 MiB, até 2 CPUs, 2 GiB de memória, 64 processos, limite de arquivo de 32 MiB e timeout de 120 s. `HOME` e temporários apontam para `/scratch`. Só valores fictícios entram nos testes. Nenhum servidor do projeto foi iniciado.

- `npm run test:security`: **14 testes aprovados**, com Node Test Runner e transpilation TypeScript; executam as funções reais com dependências explicitamente simuladas. Validam comportamento e não substituem integração com Prisma, Postgres, navegador ou provedores.
- `tsc --noEmit --incremental false`: **aprovado**, checagem de tipos do snapshot revisado em contêiner.
- ESLint completo (`eslint .` no snapshot): **0 erros e 45 avisos**; os avisos não foram silenciados.
- Vitest: não iniciou no Linux porque as dependências presentes no host só incluem o Rollup para Windows; falta `@rollup/rollup-linux-x64-musl`. Não se instalou dependência nem se executou a suíte no host fora do isolamento exigido pela skill.
- Build Next e E2E não foram validados. Os testes Vitest existentes foram atualizados para o contrato novo, mas não devem ser declarados aprovados sem execução.

A [skill de segurança](C:/Users/jeffe/.agents/skills/security-audit/SKILL.md) determina: “Do not install dependencies or let builds fetch them.” Isso impediu baixar os binários Linux ausentes durante esta validação. O próximo ambiente de CI deve ser preparado com as dependências corretas antes da execução isolada.

## Antes de liberar ao cliente

1. Executar a suíte Vitest, lint completo, build e E2E em CI Linux isolado com dependências corretas; usar apenas banco/contas fictícios. Testar concorrência de reservas, códigos e quotas em Postgres real.
2. Resolver as decisões de produto de NV-06, NV-09, NV-10 e NV-14. A auditoria não estabelece segurança jurídica, nem esta alteração o faz.
3. Conferir proxy e rate limit distribuído; levantar contas demo, e-mails duplicados, horários não canônicos e payloads antigos sem expor dados pessoais em logs.
4. Implementar paginação/avaliações agregadas e migrations somente depois de examinar conflitos existentes e preparar rollback.

**Risco comercial:** não prometer “auditoria integralmente corrigida”, proteção contra todo abuso, exclusão imediata de prontuários ou ausência de cobrança duplicada. Continuam existindo pendências de dados, infraestrutura, regras de negócio e integração de pagamentos. Publicar uma branch para revisão não é homologar produção.

Allowlist push conferida com documentação dos provedores: [Mozilla Autopush](https://mozilla-services.github.io/autopush-rs/http.html), [Apple Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers) e [Microsoft WNS](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/push-notifications/wns-overview). A lista é uma política conservadora do aplicativo; não representa todos os serviços Web Push possíveis.
