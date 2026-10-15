# Lince Pet

Plataforma para conectar tutores de pets a veterinários, clínicas e prestadores de serviço (banho, tosa, passeio, hospedagem e afins). O tutor busca profissionais, agenda consulta ou pedido, acompanha o prontuário e avalia o atendimento. Veterinários, clínicas e prestadores gerenciam agenda, equipe, avisos e assinatura.

O site público se apresenta como: *agende uma consulta para o seu pet* — busca por localização, especialidade e plano de saúde, com histórico clínico e avaliações.

Este repositório é o aplicativo completo: interface e API no mesmo Next.js. O backend antigo em AdonisJS foi migrado para Route Handlers. O contrato HTTP (paths, JSON, status e mensagens de erro) foi mantido.

As regras de negócio detalhadas ficam em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md). Este README descreve o produto, como rodar e onde cada coisa mora.

## Quem usa

| Perfil | `user_type` | O que faz |
|---|---|---|
| Tutor | `tutor` | Cadastra pets, busca profissionais, agenda, acompanha prontuário, favorita e avalia |
| Veterinário | `veterinario` | Atende presencial e online, bloqueia agenda, escreve prontuário e anotação privada, encaminha |
| Clínica | `clinica` | Monta equipe de veterinários (com limite do plano), vê agenda da equipe e encaminha |
| Prestador | `prestador` | Oferece serviços pet (duração ou diária), aceita ou recusa pedidos e conclui com código |

Cada conta tem um tipo só. Prestador que faz dois serviços diferentes (por exemplo tosa e hospedagem) usa duas contas. O tipo do prestador vem do catálogo `tipos_servico`; tipo novo é uma linha no banco, sem código novo.

## O que a plataforma faz

- **Busca** em `/explorar`: veterinários, clínicas e profissionais pet, filtrados por plano de saúde, tipo de serviço, nome ou nota. Só entra quem aceita o plano marcado. Sem resultado, a lista fica vazia.
- **Consulta veterinária:** o tutor marca horário na grade do veterinário. O sistema checa limite do plano, bloqueios e notifica as partes. O atendimento começa com um código; depois o veterinário registra o prontuário.
- **Pedido de serviço:** mesmo modelo de agendamento, com prestador e serviço. Duração (banho, passeio) precisa caber na grade do dia. Período (hospedagem) vai de um dia a outro, até 30 dias, com preço de diária. O prestador aceita ou recusa antes de o tutor ver o código de início.
- **Prontuário:** registro clínico por consulta (queixa, diagnóstico, tratamento, peso, vacinas, retorno). O tutor dono e qualquer veterinário ou clínica com consulta não cancelada daquele pet veem o histórico inteiro. A anotação privada do veterinário não entra no prontuário.
- **Encaminhamento:** a partir do atendimento, veterinário ou clínica encaminha o pet para outra clínica, outro veterinário ou um prestador. O destino aceita ou recusa. Quem marca a próxima consulta é o tutor.
- **Agenda:** grade semanal no perfil e bloqueios pontuais ou recorrentes. Bloquear um dia não muda a grade. Consulta atingida pelo bloqueio do veterinário é cancelada e o tutor é avisado; o estorno do pagamento é manual.
- **Assinatura:** cobrança mensal no Asaas (Pix, boleto ou cartão na fatura do Asaas). A plataforma não guarda cartão. Primeira assinatura paga tem 14 dias de teste sem cartão.
- **Avisos:** sino no app (sempre ligado), e-mail e WhatsApp (o usuário desliga no perfil) e evento no Google Agenda de quem conectou a conta.

### Planos

Preço, nome, limite e features vêm da tabela `subscription_plans`. Texto e ícone da tela ficam em `src/config/planos.ts`, casados pelo `code`.

| Código | Para quem | Referência |
|---|---|---|
| `vet_starter` | Veterinário | R$ 39,90 |
| `vet_pro` | Veterinário | R$ 59,90, com módulo financeiro; aparece antes na busca |
| `starter` | Clínica pequena | R$ 99,90, até 5 veterinários |
| `clinic` | Clínica média | R$ 149,90, até 15 veterinários |
| `clinic_pro` | Clínica grande | R$ 219,90, veterinários ilimitados |
| `free` | Prestador | 10 pedidos por mês |
| `pro` | Prestador | Pedidos ilimitados |

Veterinário e clínica começam sem plano (`none`) e só usam os recursos pagos depois de assinar. Prestador começa no `free`. Fora do teste grátis, o plano só entra depois do pagamento confirmado no webhook do Asaas. Inadimplência devolve o dono ao plano padrão. Cancelar remove o plano na hora.

## Stack

- **Next.js 15** (App Router, Turbopack) e **React 19**
- **TypeScript**
- **PostgreSQL 16** com **Prisma 6** (local no Docker ou Supabase)
- **Tailwind CSS 4** no código novo; CSS Modules nas telas que já existiam
- **VineJS** na validação da API (mesmo formato de erro do Adonis)
- **JWT HS256** no cookie httpOnly `auth_token` (30 dias). Senha em scrypt no formato PHC do Adonis
- **Asaas** (assinaturas), **Resend** (e-mail), **S3** (uploads), **Google** (login e Calendar), **WhatsApp** (provedor trocável; o padrão `log` só registra no console)
- **Vitest** e **Stryker** nos testes de servidor

## Mapa do repositório

```
src/app/                  páginas e Route Handlers (src/app/api)
src/components/           UI compartilhada
src/hook/<dominio>/       estado e regra de tela
src/services/<dominio>/   chamadas HTTP do browser (axios em src/hook/api)
src/contexts/             estado que cruza telas (hoje AuthContext)
src/server/               domínio e infra, só no servidor (import 'server-only')
  http.ts                 respostas, erros e serialização no estilo Lucid
  auth/                   sessão, senha e JWT
  services/               agendamento, assinatura, prontuário, WhatsApp, storage...
  validators/             VineJS
  emails/                 HTML dos e-mails
src/config/               textos de planos e contatos do site
prisma/                   schema, migrations, seed e catálogo
docs/ARQUITETURA.md       regras de negócio
tests/server/             testes unitários e de cobertura
```

O fluxo da interface é: componente (só markup) → hook em `src/hook` → função em `src/services` → cliente HTTP. Página (`page.tsx`) é Server Component: não leva `'use client'`.

Toda rota de API passa por `route()` + `ApiRequest.from()` e, quando exige login, `requireUser()`. A resposta sai de `src/server/http.ts`.

## Páginas

**Público:** `/`, `/explorar`, `/veterinario/[id]`, `/clinicas`, `/clinicas/[id]`, `/profissionais/[id]`, `/precos`, `/como-funciona`, `/servicos`, `/sobre`, `/contato`, `/ajuda`, `/seguranca`, `/cookies`, `/termos-de-uso`, `/politica-de-privacidade`.

**Conta:** `/login`, `/signup` (tutor, veterinário, clínica, prestador e social), `/forgot-password`, `/reset-password`, onboarding em `/onboarding`, `/onboarding/clinica` e `/onboarding/prestador`.

**Painel:** `/dashboard/tutor`, `/dashboard/veterinario`, `/dashboard/clinica`, `/dashboard/prestador`, com perfil e, para veterinário e clínica, troca de plano.

## Como rodar

Requisitos: Node.js 20, npm e Docker.

```bash
cp .env.example .env
# preencha pelo menos APP_KEY (mesmo valor do Adonis, se for reaproveitar senhas e tokens)

npm install
npm run db:up          # Postgres em 127.0.0.1:5433 e prisma migrate deploy
npm run db:seed        # catálogo + contas de demonstração
npm run dev            # http://localhost:3000
```

`npm run db:up` sobe o Postgres e aplica as migrations pendentes. Não roda o seed. O seed é idempotente: rodar de novo não duplica linha.

O `.env` de desenvolvimento aponta `DATABASE_URL` e `DIRECT_URL` para `127.0.0.1:5433`. As duas variáveis são iguais no ambiente local. O processo do Next precisa de `TZ=UTC`: datas de dashboard e agendamento assumem o servidor em UTC.

### Contas de demonstração

O seed cria tutores, veterinários, clínicas, pets, consultas (pendente, confirmada, realizada e cancelada), avaliações, favoritos, prontuário, uma anotação privada e um bloqueio de agenda. Os e-mails terminam em `mockup`. A senha de todas essas contas é `senha123`. Conta que já existe não tem a senha alterada.

Sem o seed, a listagem de planos e o cadastro de especialidades ficam vazios: o baseline `0_init` não traz planos, especialidades, planos de saúde nem diferenciais.

### Scripts

| Comando | Efeito |
|---|---|
| `npm run dev` | Next em modo desenvolvimento (Turbopack) |
| `npm run build` | Build de produção |
| `npm start` | Aplica as migrations do `.env.production` e sobe o Next |
| `npm run lint` | ESLint |
| `npm test` | Testes unitários em `tests/server` |
| `npm run test:coverage` | Cobertura de `src/server/services` (mínimo 95% por arquivo) |
| `npm run test:mutation` | Stryker nos serviços críticos (lento; sob demanda ou CI noturno) |
| `npm run test:contract` | Compara Adonis e Next quando `CONTRACT_ADONIS_URL` e `CONTRACT_NEXT_URL` existem |
| `npm run db:up` / `db:down` | Sobe ou derruba o Postgres local |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:seed` | Catálogo e dados de demonstração |
| `npm run db:migrar-mysql` | Copia o MySQL antigo para o `DATABASE_URL` |
| `npm run db:pull` | Introspecta o banco e regenera o client |

## Variáveis de ambiente

O modelo está em [`.env.example`](.env.example). Não commite `.env` nem `.env.production`.

| Grupo | Variáveis | Para quê |
|---|---|---|
| App | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CDN_BASE_URL`, `FRONTEND_BASE_URL`, `TZ`, `APP_KEY` | Origem da API (`/api` em produção), URLs públicas e segredo do JWT. `APP_KEY` igual ao do Adonis mantém tokens e senhas já emitidos |
| Banco | `DATABASE_URL`, `DIRECT_URL` | Conexão da aplicação e do Prisma Migrate |
| MySQL legado | `MYSQL_ORIGEM_URL` | Só para `db:migrar-mysql` |
| E-mail | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_LOGO_URL` | Envio via Resend |
| Arquivos | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_PUBLIC_BASE_URL` | Upload no S3 |
| Asaas | `ASAAS_ENV`, chaves e URLs de sandbox/produção, `ASAAS_WEBHOOK_TOKEN` | Assinaturas. Em `ASAAS_ENV=production` o token do webhook é obrigatório |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, callbacks de login e Calendar | Login social e agenda |
| WhatsApp | `WHATSAPP_PROVIDER` (padrão `log`), `WHATSAPP_API_URL`, `WHATSAPP_API_KEY`, `WHATSAPP_INSTANCE` | Número central da Lince Pet. `log` não envia mensagem de verdade |
| Cron | `CRON_SECRET` | Bearer de `GET /api/cron/lembretes-whatsapp` |

## Banco

PostgreSQL. Em desenvolvimento, o Compose (`docker-compose.yml`) sobe `postgres:16` na porta **5433**, usuário e senha `lincepet`, banco `lincepet`, e um serviço `migrate` que aplica `prisma migrate deploy` e encerra.

Em produção, `DATABASE_URL` e `DIRECT_URL` ficam no `.env.production` e apontam para o pooler do Supabase em modo sessão (porta 5432). A conexão direta `db.<ref>.supabase.co` é só IPv6. A aplicação autentica com o próprio JWT e usa o usuário `postgres` do banco.

Convenções que o código assume:

- Booleanos são `Int` (0/1). O frontend compara com `0` e `1`.
- ENUMs do Postgres são enums do Prisma. Ler como `String` quebra com P2032.
- `User` para tutor, veterinário, clínica e prestador é lista no Prisma (`user_id` sem unique). A busca é `findFirst({ where: { userId } })`.
- O schema não tem default de UUID nem de timestamp. Criar e atualizar passam por `creating()` e `updating()` em `src/server/lucid.ts`.
- `agendamentos.data_consulta` é texto `YYYY-MM-DD`. Valores decimais saem como string com duas casas. Datas saem em ISO.
- E-mail é gravado em minúsculas. Busca com `contains` usa `mode: 'insensitive'`.
- Migrations: baseline `prisma/migrations/0_init`. Em banco que já existia antes do Prisma, rode uma vez `prisma migrate resolve --applied 0_init`. Não use `migrate reset` em produção.

A cópia do MySQL antigo (`npm run db:migrar-mysql`) sem `--executar` só confere tabelas, colunas e contagens. Com `--executar`, copia numa transação (`ON CONFLICT DO NOTHING`). Use `--env=.env.production` para o Supabase, com o destino recém-migrado e antes do seed.

## Autenticação

`POST /api/auth/login` grava o cookie `auth_token`. `GET /api/auth/me` devolve o usuário. O frontend não guarda token: chama `/api` na mesma origem com credenciais. Login social fica em `/api/auth/google/*`. Esqueci a senha compara e-mail sem diferenciar maiúsculas.

`requireUser(req, [tipos])` exige o JWT e, se a lista vier preenchida, o `user_type`.

## Integrações

- **Asaas.** Contratar, trocar e cancelar em `/api/assinaturas/*`. Quem aplica plano e status é `POST /api/webhooks/asaas`, idempotente por `webhook_events.event_id`. O header `asaas-access-token` precisa bater com `ASAAS_WEBHOOK_TOKEN`.
- **Google Agenda.** Tutor e veterinário conectam a própria conta. Para o veterinário, conectar exige plano Pro. Criar, remarcar e cancelar consulta sincroniza o evento. Falha do Google não derruba o agendamento. Desconectar para de criar eventos novos e não apaga os que já existem.
- **WhatsApp.** Um número só, da Lince Pet. Veterinários e clínicas não conectam número próprio. Sai se o veterinário ou a clínica da consulta tiver a feature `whatsapp_notifications` e se o destinatário não tiver desligado o canal. Lembretes de 24h e 2h: `GET /api/cron/lembretes-whatsapp` a cada 15 minutos (`vercel.json`), com `Authorization: Bearer <CRON_SECRET>`.
- **E-mail (Resend) e sino in-app.** O sino não desliga. O e-mail desliga no perfil; o código de início da consulta também aparece no painel do tutor.
- **S3.** Upload multipart vira arquivo público no bucket.

Envio de e-mail, WhatsApp e Google roda depois da resposta (`after()`). Falha desses canais não desfaz agendamento, cancelamento ou remarcação.

## Testes

```bash
npm test
npm run test:coverage
```

Os unitários ficam em `tests/server`. A meta de cobertura é 95% de linhas, statements e funções em cada arquivo de `src/server/services`. Prisma, Asaas, S3, Resend, WhatsApp e Google são mockados. Os testes por serviço estão em `tests/server/cobertura/`.

`npm run test:mutation` mede se os testes quebram quando o código muda (Stryker), nos fluxos de assinatura, equipe, bloqueios, pedidos de prestador e encaminhamentos. Meta de mutation score: 80% por arquivo. A primeira execução leva dezenas de minutos.

`tests/server/site-links.test.ts` falha se o Header ou o Footer apontar para `#` ou para rota inexistente, e se o copyright tiver ano fixo.

## Produção

`npm start` lê `.env.production`, aplica as migrations nesse banco e só então sobe o Next. O cron de lembretes está em `vercel.json` (`*/15 * * * *`). Há também `netlify/functions/lembretes-whatsapp.mts` para o mesmo trabalho.

Contatos do site (e-mail, WhatsApp, redes) ficam em `src/config/site.ts`. Campo vazio não vira link.

## Onde ler mais

[`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) é a fonte das regras: bloqueio de agenda, anotação privada, prontuário, equipe da clínica, assinatura, busca, WhatsApp, Google Agenda, prestadores e encaminhamento. Decisão nova de produto entra nesse arquivo.
