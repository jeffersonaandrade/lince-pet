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

## Testes

- `npm test`: unitários (`tests/server`).
- `npm run test:contract`: compara Adonis x Next quando `CONTRACT_ADONIS_URL` e `CONTRACT_NEXT_URL` estão definidos.
