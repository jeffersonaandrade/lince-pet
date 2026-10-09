# Arquitetura Lince Pet (Next.js fullstack)

O backend AdonisJS (`Lince-Pet-Backend-main`) foi migrado para Route Handlers do Next.js neste repositório. O contrato HTTP (paths, JSON, status e mensagens) é o mesmo do Adonis, então o frontend não mudou além da autenticação.

## Camadas

| Camada | Onde | Regra |
|---|---|---|
| Rotas HTTP | `src/app/api/**/route.ts` | Sempre `route()` + `ApiRequest.from()` + `requireUser()`; responder com `ok/created/...` de `src/server/http.ts` |
| Infra HTTP | `src/server/http.ts` | `handleError` reproduz o exception handler do Adonis (422 VineJS, `HttpError`, 500 genérico); `json()` serializa como o Lucid |
| Compatibilidade Lucid | `src/server/lucid.ts` | `creating()`/`updating()` (UUID e timestamps não têm default no schema), `paginate()`, `serialize()` |
| Auth | `src/server/auth/*` | JWT HS256 com `APP_KEY` (30 dias) no cookie httpOnly `auth_token`; senha scrypt no formato PHC do Adonis; `requireUser(req, [tipos])` = middlewares jwtAuth + userType |
| Domínio | `src/server/services/*` | Asaas, storage S3, e-mail (Resend), WhatsApp, Google Calendar, notificações in-app, limites de plano, onboarding |
| Validação | `src/server/validators/*` | VineJS v3 (mesmas mensagens do backend antigo) |
| E-mails | `src/server/emails/*` | Templates Edge convertidos em funções TS que retornam HTML |
| Banco | `prisma/schema.prisma` + `src/server/db.ts` | PostgreSQL (local via Docker ou Supabase); Prisma singleton com `omit` global de senha e tokens Google |

Todo arquivo em `src/server` começa com `import 'server-only'`.

## Convenções herdadas do banco

- Booleanos são `Int` (0/1): o frontend compara com `0`/`1` (ex.: `onboardingComplete === 0`).
- ENUMs do Postgres (`user_type`, `genero`, `tipo_clinica`, `porte`, `payments.type`) são enums do Prisma. Como `String`, a leitura no banco real falha com P2032.
- Conexão: `DATABASE_URL` e `DIRECT_URL` são iguais. No `.env` (dev e Prisma local) apontam para `127.0.0.1:5433`. No `.env.production` (`next build` / `next start`) apontam para o pooler do Supabase em modo sessão, porta 5432 do host `aws-0-us-east-2.pooler.supabase.com`. A conexão direta `db.<ref>.supabase.co` é só IPv6. A app autentica com o próprio JWT; usa o usuário `postgres` do banco, não a chave anon.
- Busca textual em SQL cru usa `ILIKE` (o Postgres diferencia maiúsculas). Login e “esqueci a senha” também comparam e-mail sem diferenciar maiúsculas. O índice único de `users.email` diferencia: o cadastro grava o e-mail em minúsculas.
- `User -> tutor/veterinario/clinica/prestador` são listas no Prisma (`user_id` sem UNIQUE): usar `findFirst({ where: { userId } })`.
- DECIMAL sai como string com 2 casas; datas saem em ISO (servidor em `TZ=UTC`).
- `agendamentos.data_consulta` é VARCHAR (`YYYY-MM-DD`).
- Migrations: Prisma Migrate com baseline `prisma/migrations/0_init`. `docker compose up` sobe o Postgres local e aplica as migrations pendentes; não roda o seed (`npm run db:seed` é separado). `npm start` aplica as migrations do `.env.production` (Supabase) e só então sobe o Next. Em banco que já existia antes do Prisma: `prisma migrate resolve --applied 0_init` uma única vez.

## Fluxos principais

- **Login:** `POST /api/auth/login` grava o cookie `auth_token`; `GET /api/auth/me` devolve o usuário; o frontend não guarda token.
- **Google:** login social em `/api/auth/google/*` (state em cookie) e Calendar em `/api/google/calendar/*` (state JWT).
- **Agendamento:** `POST /api/agendamentos` checa limite do plano, grava, notifica (in-app; e-mail e WhatsApp conforme "Canais de aviso e Google Agenda") e cria evento no Google Agenda via `after()`.
- **Assinaturas:** `/api/assinaturas/*` cria/atualiza no Asaas; `POST /api/webhooks/asaas` é idempotente via `webhook_events.event_id`.
- **Uploads:** multipart -> `UploadedFile` -> S3 (`src/server/services/storage.ts`).
- **Agenda:** a grade semanal fica em `veterinario_enderecos.horarios_funcionamento` (presencial) e `veterinarios.horarios_online`, editada no Perfil. Bloqueios pontuais ficam em `bloqueios_agenda` (`src/server/services/bloqueios.ts`). `GET /api/agendamentos/disponibilidade/:vet` devolve `horarios_ocupados` (consultas + bloqueios), `horarios_bloqueados` e `dia_bloqueado`.

## Regras de negócio

Toda decisão de negócio nova entra aqui e no grafo do graphify (ver `.cursor/rules/graphify.mdc`).

### Bloqueio pontual de agenda

- **Grade semanal x bloqueio pontual:** a grade semanal é recorrente e não é alterada pelo bloqueio. O bloqueio vale só para as datas informadas (bloquear 15/10 não afeta 22/10).
- **Diário ou período (pontual):** um bloqueio tem `data_inicio`/`data_fim` (`YYYY-MM-DD`, até 31 dias, sem datas passadas). `horarios = null` bloqueia o dia inteiro; uma lista `HH:mm` bloqueia só esses horários em cada dia do período.
- **Recorrente (toda semana):** `recorrente = 1` + `dias_semana` (0=domingo) repete o bloqueio nesses dias a partir de `data_inicio`; `data_fim` é opcional (null = até o profissional remover) e não tem limite de 31 dias. Serve para "toda quinta só atendo de manhã" sem mexer na grade do Perfil.
- **Intervalo de horários:** no modal, "Das/Até" marca de uma vez todos os horários de 30 min do intervalo (fim exclusivo: 11:00–17:00 bloqueia 11:00 a 16:30). Assim o vet fecha 3–5 horas e atende só no restante do dia.
- **Quem bloqueia:** o veterinário (`/api/veterinarios/bloqueios`) e a clínica com vínculo `aceito` (`/api/clinicas/veterinarios/:vet/bloqueios`, `DELETE /api/clinicas/bloqueios/:id`). Sem vínculo aceito: 404.
- **Consultas no período:** o front chama `POST ...?preview=1` e mostra as consultas `pendente`/`confirmado` afetadas. Ao confirmar, elas são canceladas com motivo "Agenda bloqueada pelo profissional", o uso mensal do vet é devolvido e o tutor é avisado (in-app + e-mail).
- **Sem estorno automático:** consulta paga cancelada pelo bloqueio é estornada manualmente.
- **Vale para todos os locais:** o bloqueio é do veterinário, não do endereço (presencial e online).
- **Remover bloqueio** libera os horários, mas não restaura consultas canceladas.
- **Trava no backend:** `POST /api/agendamentos` e `PATCH /api/agendamentos/:id/reagendar` recusam horário bloqueado (400).

### Anotações privadas do veterinário

- **Visibilidade:** a anotação (`agendamento_anotacoes`, 1:1 com a consulta) é lida/editada só pelo veterinário dono em `GET/PUT /api/veterinarios/agendamentos/:id/anotacao` (outro vet: 404). Fica em tabela separada e nenhuma rota de tutor ou clínica a inclui.
- **Quando pode:** a partir do início do atendimento (`started_at` preenchido, status "em andamento") e depois de concluída, sem prazo para editar. Pendente, confirmada ou cancelada: 400.
- **Campos:** local do atendimento (endereços do vet, Online, Domicílio ou texto livre), status do pagamento (`pago`/`pendente`/`isento`), forma (`pix`/`cartao`/`dinheiro`/`plano_pet`/`outro`), nome do plano (só com `plano_pet`) e observações do paciente (até 5.000 caracteres).
- **Não altera pagamento real:** os campos de pagamento são registro do vet; `payment_status` da consulta e o Asaas não mudam.
- **Histórico por pet:** no modal da consulta (qualquer status, exceto cancelada) o vet abre o histórico do pet: `GET /api/veterinarios/agendamentos/:id/anotacao/historico` devolve só as anotações **dele** em outras consultas do mesmo pet, mais recentes primeiro. Anotações de outros veterinários nunca aparecem.

### Prontuário do pet

- **Registro clínico por consulta** (`registros_clinicos`, 1:1 com a consulta): queixa, diagnóstico, tratamento/prescrição, peso (0 a 500 kg), vacinas/medicações aplicadas, retorno sugerido (hoje ou futuro), plano de saúde usado e encaminhamento em texto livre. Textos com até 5000 caracteres.
- **Autor:** só o vet da consulta escreve (`GET/PUT /api/veterinarios/agendamentos/:id/registro`), com a mesma janela da anotação privada: a partir do início do atendimento, editável depois de concluída; consulta cancelada não tem registro.
- **Acesso ao prontuário** (`GET /api/pets/:id/prontuario`): o tutor dono e qualquer vet ou clínica com consulta **não cancelada** do pet (inclusive futura, para se preparar; confirmado pela dona do produto) veem o prontuário inteiro, com registros de outros profissionais. Demais usuários recebem 404.
- **Tutor vê tudo:** todos os registros clínicos aparecem para o tutor dono, sem marcação de compartilhamento.
- **Sem nota privada:** o prontuário nunca inclui a anotação privada (`agendamento_anotacoes`). O plano registrado na anotação é dado financeiro do vet; o plano clínico fica no registro.
- **Pet novo:** começa com o prontuário vazio e acumula uma entrada por consulta não cancelada.

### Equipe da clínica

- **Lista:** `GET /api/clinicas/professionals` e `GET /api/veterinarios` (clínica) devolvem os veterinários com vínculo `aceito` (`src/server/services/clinica-equipe.ts`).
- **Remover = desfazer vínculo:** `DELETE /api/clinicas/professionals/:id` e `DELETE /api/veterinarios/:id` apagam só o vínculo com aquele veterinário. A conta, as consultas e o histórico do veterinário permanecem. Sem vínculo: 404.

### Site institucional e links

- **Sem link quebrado:** Header e Footer não têm `href="#"` nem apontam para rota inexistente; página que ainda não existe não ganha link. `tests/server/site-links.test.ts` garante isso.
- **Contatos centralizados:** e-mail, WhatsApp e redes sociais ficam em `src/config/site.ts`. Campo vazio não vira link (mostra "Em breve"); rede social sem URL não aparece no rodapé.
- **Links externos** (WhatsApp, redes) abrem em nova aba (`target="_blank" rel="noopener noreferrer"`).
- **Ano vigente no copyright:** o rodapé do site (`src/components/Footer/AnoAtual.tsx`, client, para não ficar preso ao ano do build) e os e-mails de consulta (`src/server/emails/*`) mostram sempre o ano atual. `tests/server/site-links.test.ts` falha se houver "© 20xx" fixo em `src`.
- **Planos com fonte única:** `/precos` e as telas de alterar plano (vet e clínica) leem `src/config/planos.ts`.
- **Páginas:** `/sobre`, `/contato`, `/como-funciona`, `/servicos` (especialidades do banco, ISR 1h), `/precos`, `/ajuda` (Central de Ajuda + FAQ), `/seguranca`, `/cookies`. Textos em rascunho até revisão do cliente.
- **Estilo:** páginas novas em Tailwind (`src/components/Institucional/PaginaInstitucional.tsx`). Os resets globais ficam em `@layer base` no `globals.css`; sem layer, eles venceriam as utilities do Tailwind.

### Catálogo inicial do banco

- **Banco vazio:** `npx prisma db seed` (`prisma/seed.ts`) grava o que o baseline `0_init` não traz: planos de assinatura, especialidades oficiais, planos de saúde e diferenciais de clínica. Sem isso, a listagem de planos e o cadastro de especialidades ficam vazios.
- **Planos de assinatura:** `free`, `pro`, `pro_plus`, `starter`, `clinic`, `clinic_pro`, com preço em centavos, limite mensal, features, prioridade de busca e trial do banco que já rodava o Adonis (incluindo os ajustes feitos em migration). Upsert por `code`, sem trocar o id. O texto de `/precos` continua em `src/config/planos.ts`.
- **Especialidades:** a lista de `src/data/especialidades.ts` (a mesma da migration que populava `especialidades`). Upsert por nome; não apaga nomes extras que já existam.
- **Planos de saúde e diferenciais:** os nomes que o `mockup_seeder` criava para o perfil (`planos` e `diferenciais`). Upsert/first-or-create por nome.
- **Demonstração:** o mesmo comando cria tutores, veterinários, clínicas, pets, consultas (pendente, confirmada, realizada e cancelada), avaliações, favoritos, prontuário, uma anotação privada e um bloqueio de agenda. Cidades e especialidades variadas. E-mails terminam em `mockup`. Senha de todas essas contas: `senha123`. Não altera senha de quem já existe.
- **Idempotente:** rodar de novo não duplica linha.

### Busca por plano de saúde

- **Mesma lista do cadastro:** o filtro "Plano de Saúde" em `/explorar` lista os nomes da tabela `planos` (`GET /api/planos`), os mesmos que veterinário e clínica marcam no onboarding e no perfil. Não há lista fixa à parte.
- **Só quem aceita:** `GET /api/veterinarios/search?plano=` e `GET /api/clinicas?plano=` devolvem apenas quem tem aquele nome em `veterinario_planos` ou `clinica_planos`. A comparação não diferencia maiúsculas.
- **Sem exemplo:** se ninguém aceita o plano, `/explorar` fica vazio. Não entra profissional fictício.
- **Perfil e card da busca:** `/veterinario/[id]`, `/clinicas/[id]` e o card do veterinário em `/explorar` mostram só os planos ligados àquele cadastro.
- **Ordenação:** o ícone de filtro na barra de `/explorar` ordena a aba atual (veterinários, clínicas e profissionais pet) por nome ou por nota, crescente ou decrescente. A ordem fica na URL (`ordem=nome|nota`, `direcao=asc|desc`) e não dispara nova busca. Sem esses parâmetros, a lista permanece na ordem da API. Empate de nota desempata pelo nome. Nota ausente conta como zero.

### Notificações por WhatsApp

- **Número central:** todas as mensagens saem de um único número da Lince Pet, que distribui avisos para tutores, vets e clínicas. Vet e clínica não conectam número próprio.
- **Provedor agnóstico:** `src/server/services/whatsapp.ts` define `WhatsAppProvider` e escolhe o driver por `WHATSAPP_PROVIDER` (padrão `log`, que só registra). Trocar de provedor (Z-API, UltraMsg, Evolution...) = novo driver, sem mexer nos fluxos. Provedores não oficiais têm risco de banimento do número.
- **Eventos e destinatários:** confirmação (tutor) e novo agendamento (profissional) na criação; lembretes 24h e 2h antes (tutor); cancelamento pelo tutor (profissional); cancelamento por bloqueio de agenda (tutor, com o motivo); remarcação (tutor e profissional). Profissional = celular do vet, ou o WhatsApp da clínica se o vet não tiver celular.
- **Plano:** só envia se o vet **ou** a clínica da consulta tiver a feature `whatsapp_notifications`. Sem plano: registra `ignorado/sem_plano`.
- **Opt-out:** `users.notificar_whatsapp` (padrão ligado), de tutor e de vet, alterado em Perfil > Avisos de consulta. Desligado: quem desligou não recebe nada por WhatsApp (a outra parte continua recebendo). Vet que desligou também não recebe pelo WhatsApp da clínica.
- **Lembretes:** `GET /api/cron/lembretes-whatsapp` (Bearer `CRON_SECRET`; sem segredo configurado, 401), a cada 15 min (`vercel.json` ou `netlify/functions/lembretes-whatsapp.mts`). Janela 24h: entre 24h e 2h antes; janela 2h: até o início. Consulta criada depois que a janela abriu não recebe aquele lembrete (a confirmação já cobre).
- **Idempotência e registro:** cada envio grava `whatsapp_envios` com chave única (consulta, evento, destinatário, data+hora da consulta). Repetir o cron não duplica; remarcar muda a referência e libera novos lembretes. Status: `enviado`, `falhou` (com erro) ou `ignorado` (`sem_plano`, `opt_out`, `sem_celular`).
- **Não bloqueia o fluxo:** envio roda em `after()`, com até 2 tentativas só para erro temporário (429/5xx/rede). Falha do provedor nunca derruba agendamento, cancelamento ou remarcação.

### Canais de aviso e Google Agenda

- **Canais por usuário:** tutor e vet escolhem e-mail e WhatsApp em Perfil > Avisos de consulta (`GET/PUT /api/me/notificacoes`, colunas `users.notificar_email` e `users.notificar_whatsapp`, padrão ligado). O aviso só sai pelos canais ligados (`src/server/services/canais-notificacao.ts`). Os avisos in-app (sino) não são desligáveis.
- **E-mail desligável por completo:** como o código de início da consulta ia só por e-mail, ele aparece no painel do tutor (`codigo_inicio` em `GET /api/agendamentos`) nas consultas futuras não canceladas e não iniciadas.
- **Google Agenda = conexão:** o canal fica ativo enquanto a conta Google estiver conectada; não há interruptor separado. Tutor e vet conectam a própria conta (`/api/google/calendar/auth`). Para o vet, conectar exige plano Pro (trava no front).
- **Sincronização do evento:** criar consulta insere o evento na agenda de cada participante conectado; remarcar atualiza o evento (se sumiu no Google, cria outro); cancelar (pelo tutor ou por bloqueio de agenda) apaga o evento. O id fica em `agendamento_google_eventos` (consulta x usuário). Falha do Google nunca derruba o fluxo; 401/403 desliga a integração do usuário.
- **Desconectar:** `POST /api/google/calendar/disconnect` revoga o token no Google (melhor esforço) e limpa as credenciais. Para de criar eventos novos; não apaga consultas da plataforma nem os eventos já criados no Google.

### Prestadores de serviço pet

- **Conta genérica:** tosador, passeador, adestrador, pet sitter e os próximos tipos usam a mesma conta `prestador` (`user_type = prestador`). O tipo vem do catálogo `tipos_servico` (`slug`, `nome`, `modalidade`), populado pelo seed; tipo novo = linha nova no catálogo, sem código novo. Cadastro em `/signup/prestador`, onboarding em 3 passos (onde atende, serviços e preços, apresentação e grade semanal), painel em `/dashboard/prestador`, perfil público em `/profissionais/:id`.
- **Um tipo por prestador:** quem faz dois serviços diferentes cria duas contas. Dentro do tipo, o prestador cadastra vários serviços (`servicos_oferecidos`), cada um com preço e, na modalidade duração, minutos.
- **Sem dados de veterinário:** sem CRMV, especialidade, consulta online, prontuário, registro clínico ou anotação privada. A tela e as rotas são próprias (`src/server/services/prestadores.ts` e `pedidos-prestador.ts`).
- **Busca:** aba "Profissionais" em `/explorar` com filtro por tipo (`GET /api/prestadores/search?tipo=`); só aparece quem concluiu o onboarding e está ativo.
- **Pedido = `Agendamento`:** com `prestador_id` e `servico_oferecido_id`, sem veterinário. Todo pedido tem `inicio_em`/`fim_em` (UTC; regras de dia/horário em `America/Sao_Paulo`).
  - **Duração** (banho, tosa, passeio, adestramento): fim = início + duração do serviço; precisa caber na grade do dia.
  - **Período** (hospedagem / pet sitter): entrada e saída em dias diferentes, até 30 dias; preço = diária × número de dias (arredondado para cima). Entrada e saída precisam cair dentro da grade dos respectivos dias.
- **Sem sobreposição:** pedidos `pendente`, `confirmado` ou `em andamento` ocupam a agenda; outro pedido que sobreponha o período recebe 409. A checagem é refeita na transação.
- **Local:** o tutor escolhe domicílio (endereço do tutor) ou local do profissional, só entre os que o prestador atende.
- **Aceite obrigatório:** o pedido nasce `pendente`; o prestador aceita (`confirmado`) ou recusa (`cancelado`, com motivo opcional). Remarcar pelo tutor volta o pedido para `pendente`.
- **Código de início:** o tutor só vê o código depois do aceite. O prestador digita o código para iniciar (`em andamento`, até 5 tentativas) e depois conclui (`realizado`); o tutor pode avaliar o serviço concluído.
- **Bloqueio de agenda do prestador:** mesmo modelo de `bloqueios_agenda` (dia inteiro ou horários, cada horário bloqueia 1h). Diferente do vet, bloqueio que atinge pedido ativo é recusado com 409 e a lista de conflitos: o prestador recusa ou combina a remarcação antes.
- **Limite do plano:** o prestador começa no plano `free` (10 pedidos/mês) e pode assinar o `pro` (ilimitado) pelo mesmo fluxo Asaas (`/api/assinaturas`, referência `prestador:<id>`). Pedido criado conta no mês; recusa ou cancelamento devolve a cota. Cancelar ou atrasar a assinatura volta para `free`.
- **Avisos:** os mesmos canais da consulta (in-app, e-mail, WhatsApp e Google Agenda) com texto de serviço ("Novo pedido de Banho e tosa", sem "Dr(a)." nem "consulta"). WhatsApp do prestador depende do plano dele ter `whatsapp_notifications`.

## Testes

- `npm test`: unitários (`tests/server`).
- `npm run test:contract`: compara Adonis x Next quando `CONTRACT_ADONIS_URL` e `CONTRACT_NEXT_URL` estão definidos.
