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
| Banco | `prisma/schema.prisma` + `src/server/db.ts` | MySQL; Prisma singleton com `omit` global de senha e tokens Google |

Todo arquivo em `src/server` começa com `import 'server-only'`.

## Convenções herdadas do banco

- Booleanos são `Int` (0/1): o frontend compara com `0`/`1` (ex.: `onboardingComplete === 0`).
- `User -> tutor/veterinario/clinica` são listas no Prisma (`user_id` sem UNIQUE): usar `findFirst({ where: { userId } })`.
- DECIMAL sai como string com 2 casas; datas saem em ISO (servidor em `TZ=UTC`).
- `agendamentos.data_consulta` é VARCHAR (`YYYY-MM-DD`).
- Migrations: Prisma Migrate com baseline `prisma/migrations/0_init` (em banco existente, `prisma migrate resolve --applied 0_init`).

## Fluxos principais

- **Login:** `POST /api/auth/login` grava o cookie `auth_token`; `GET /api/auth/me` devolve o usuário; o frontend não guarda token.
- **Google:** login social em `/api/auth/google/*` (state em cookie) e Calendar em `/api/google/calendar/*` (state JWT).
- **Agendamento:** `POST /api/agendamentos` checa limite do plano, grava, notifica (in-app, e-mail, WhatsApp) e cria evento no Google Calendar via `after()`.
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
- **Acesso ao prontuário** (`GET /api/pets/:id/prontuario`): o tutor dono e qualquer vet ou clínica com consulta **não cancelada** do pet (inclusive futura, para se preparar) veem o prontuário inteiro, com registros de outros profissionais. Demais usuários recebem 404.
- **Tutor vê tudo:** todos os registros clínicos aparecem para o tutor dono, sem marcação de compartilhamento.
- **Sem nota privada:** o prontuário nunca inclui a anotação privada (`agendamento_anotacoes`). O plano registrado na anotação é dado financeiro do vet; o plano clínico fica no registro.
- **Pet novo:** começa com o prontuário vazio e acumula uma entrada por consulta não cancelada.


## Testes

- `npm test`: unitários (`tests/server`).
- `npm run test:contract`: compara Adonis x Next quando `CONTRACT_ADONIS_URL` e `CONTRACT_NEXT_URL` estão definidos.
