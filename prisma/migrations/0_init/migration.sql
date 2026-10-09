-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('tutor', 'veterinario', 'clinica');

-- CreateEnum
CREATE TYPE "Genero" AS ENUM ('masculino', 'feminino', 'outro');

-- CreateEnum
CREATE TYPE "TipoClinica" AS ENUM ('solo', 'multipla');

-- CreateEnum
CREATE TYPE "Porte" AS ENUM ('pequeno', 'medio', 'grande');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('credits', 'appointment');

-- CreateTable
CREATE TABLE "users" (
    "id" CHAR(36) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "user_type" "UserType" NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "celular" VARCHAR(15),
    "cep" VARCHAR(8),
    "rua" VARCHAR(255),
    "cidade" VARCHAR(100),
    "estado" VARCHAR(2),
    "ativo" SMALLINT DEFAULT 1,
    "is_email_verified" SMALLINT DEFAULT 0,
    "profile_pic" VARCHAR(500),
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),
    "sobrenome" VARCHAR(100),
    "numero" VARCHAR(10),
    "bairro" VARCHAR(100),
    "google_access_token" TEXT,
    "google_refresh_token" TEXT,
    "google_token_expires_at" TIMESTAMP(0),
    "google_calendar_authorized" SMALLINT DEFAULT 0,
    "notificar_email" SMALLINT NOT NULL DEFAULT 1,
    "notificar_whatsapp" SMALLINT NOT NULL DEFAULT 1,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutores" (
    "id" CHAR(36) NOT NULL,
    "user_id" CHAR(36),
    "cpf" VARCHAR(14),
    "genero" "Genero",
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "tutores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veterinarios" (
    "id" CHAR(36) NOT NULL,
    "user_id" CHAR(36),
    "cpf" VARCHAR(14),
    "cnpj" VARCHAR(18),
    "genero" "Genero",
    "crmv" VARCHAR(15),
    "bio" TEXT,
    "foto_url" VARCHAR(1024),
    "atende_presencial" SMALLINT DEFAULT 0,
    "atende_online" SMALLINT DEFAULT 0,
    "atende_domicilio" SMALLINT DEFAULT 0,
    "preco_consulta" DECIMAL(10,2),
    "onboarding_complete" SMALLINT DEFAULT 0,
    "onboarding_step" INTEGER DEFAULT 1,
    "is_verified" SMALLINT DEFAULT 0,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),
    "creditos" INTEGER NOT NULL DEFAULT 0,
    "preco_consulta_online" DECIMAL(10,2),
    "horarios_online" JSONB,
    "subscription_plan_code" VARCHAR(50) DEFAULT 'pro',
    "monthly_appointments_used" INTEGER DEFAULT 0,
    "monthly_appointments_reset_at" TIMESTAMP(0),

    CONSTRAINT "veterinarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinicas" (
    "id" CHAR(36) NOT NULL,
    "user_id" CHAR(36),
    "cnpj" VARCHAR(18),
    "descricao" TEXT,
    "horarios_funcionamento" JSONB,
    "quantidade_vets" VARCHAR(10),
    "onboarding_complete" SMALLINT DEFAULT 0,
    "is_verified" SMALLINT DEFAULT 0,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),
    "nome_clinica" VARCHAR(200),
    "tipo_clinica" "TipoClinica" DEFAULT 'solo',
    "nome_fantasia" VARCHAR(255),
    "razao_social" VARCHAR(255),
    "endereco" VARCHAR(255),
    "cep" VARCHAR(10),
    "cidade" VARCHAR(255),
    "estado" VARCHAR(2),
    "latitude" VARCHAR(255),
    "longitude" VARCHAR(255),
    "telefone" VARCHAR(255),
    "whatsapp" VARCHAR(255),
    "horario_funcionamento" JSONB,
    "comodidades" JSONB,
    "foto_perfil" VARCHAR(255),
    "foto_capa" VARCHAR(255),
    "sobre" TEXT,
    "subscription_plan_code" VARCHAR(255) DEFAULT 'free',

    CONSTRAINT "clinicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especialidades" (
    "id" CHAR(36) NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "ativo" SMALLINT DEFAULT 1,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "especialidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veterinario_clinicas" (
    "veterinario_id" CHAR(36) NOT NULL,
    "clinica_id" CHAR(36) NOT NULL,
    "ativo" SMALLINT DEFAULT 1,
    "status" VARCHAR(255) DEFAULT 'pendente',
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "veterinario_clinicas_pkey" PRIMARY KEY ("veterinario_id","clinica_id")
);

-- CreateTable
CREATE TABLE "especialidade_relacionamentos" (
    "entidade_id" CHAR(36) NOT NULL,
    "especialidade_id" CHAR(36) NOT NULL,
    "ativo" SMALLINT DEFAULT 1,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),
    "entidade_tipo" VARCHAR(20) NOT NULL DEFAULT 'veterinario',

    CONSTRAINT "especialidade_relacionamentos_pkey" PRIMARY KEY ("entidade_id","especialidade_id","entidade_tipo")
);

-- CreateTable
CREATE TABLE "diferenciais" (
    "id" CHAR(36) NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "icone" VARCHAR(255),
    "descricao" TEXT,
    "ativo" SMALLINT DEFAULT 1,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "diferenciais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinica_diferenciais" (
    "clinica_id" CHAR(36) NOT NULL,
    "diferencial_id" CHAR(36) NOT NULL,
    "ativo" SMALLINT DEFAULT 1,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "clinica_diferenciais_pkey" PRIMARY KEY ("clinica_id","diferencial_id")
);

-- CreateTable
CREATE TABLE "experiencias_veterinarios" (
    "id" CHAR(36) NOT NULL,
    "veterinario_id" CHAR(36) NOT NULL,
    "local" VARCHAR(255) NOT NULL,
    "cargo" VARCHAR(255) NOT NULL,
    "data_inicio" DATE,
    "data_fim" DATE,
    "descricao" TEXT,
    "ativo" SMALLINT DEFAULT 1,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "experiencias_veterinarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veterinario_enderecos" (
    "id" CHAR(36) NOT NULL,
    "veterinario_id" CHAR(36) NOT NULL,
    "rua" VARCHAR(255) NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "bairro" VARCHAR(100),
    "complemento" VARCHAR(100),
    "cidade" VARCHAR(100) NOT NULL,
    "estado" VARCHAR(2) NOT NULL,
    "cep" VARCHAR(8) NOT NULL,
    "horarios_funcionamento" JSONB,
    "horarios_disponibilidade" JSONB,
    "aceita_emergencia" SMALLINT DEFAULT 0,
    "observacoes" TEXT,
    "is_primary" SMALLINT DEFAULT 0,
    "ativo" SMALLINT DEFAULT 1,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),
    "preco_consulta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "nome_clinica" VARCHAR(255),
    "foto_url" VARCHAR(255),
    "clinica_id" CHAR(36),

    CONSTRAINT "veterinario_enderecos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos" (
    "id" CHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "image" VARCHAR(255),
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "planos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veterinario_planos" (
    "veterinario_id" CHAR(36) NOT NULL,
    "plano_id" CHAR(36) NOT NULL,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "veterinario_planos_pkey" PRIMARY KEY ("veterinario_id","plano_id")
);

-- CreateTable
CREATE TABLE "clinica_planos" (
    "clinica_id" CHAR(36) NOT NULL,
    "plano_id" CHAR(36) NOT NULL,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "clinica_planos_pkey" PRIMARY KEY ("clinica_id","plano_id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" CHAR(36) NOT NULL,
    "tutor_id" CHAR(36),
    "nome" VARCHAR(255) NOT NULL,
    "especie" VARCHAR(255) NOT NULL,
    "raca" VARCHAR(255),
    "idade" INTEGER,
    "foto_url" VARCHAR(255),
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),
    "porte" "Porte",

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" CHAR(36) NOT NULL,
    "tutor_id" CHAR(36),
    "pet_id" CHAR(36),
    "veterinario_id" CHAR(36),
    "data_consulta" VARCHAR(255),
    "horario_consulta" VARCHAR(255),
    "status" VARCHAR(255) NOT NULL,
    "tipo_consulta" VARCHAR(255),
    "preco_consulta" DECIMAL(8,2),
    "observacoes" VARCHAR(255),
    "motivo_cancelamento" VARCHAR(255),
    "confirmado_em" VARCHAR(255),
    "cancelado_em" VARCHAR(255),
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),
    "start_code" VARCHAR(12),
    "start_code_expires_at" TIMESTAMP(0),
    "start_code_used_at" TIMESTAMP(0),
    "start_code_attempts" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(0),
    "ended_at" TIMESTAMP(0),
    "payment_status" VARCHAR(255) NOT NULL DEFAULT 'unpaid',
    "provider_payment_id" VARCHAR(255),
    "local_nome" VARCHAR(255),
    "local_endereco" VARCHAR(255),
    "clinica_id" CHAR(36),

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamento_google_eventos" (
    "id" CHAR(36) NOT NULL,
    "agendamento_id" CHAR(36) NOT NULL,
    "user_id" CHAR(36) NOT NULL,
    "google_event_id" VARCHAR(1024) NOT NULL,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "agendamento_google_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamento_anotacoes" (
    "id" CHAR(36) NOT NULL,
    "agendamento_id" CHAR(36) NOT NULL,
    "veterinario_id" CHAR(36) NOT NULL,
    "local_atendimento" VARCHAR(255),
    "status_pagamento" VARCHAR(20),
    "forma_pagamento" VARCHAR(30),
    "plano_nome" VARCHAR(255),
    "observacoes" TEXT,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "agendamento_anotacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_envios" (
    "id" CHAR(36) NOT NULL,
    "agendamento_id" CHAR(36),
    "evento" VARCHAR(30) NOT NULL,
    "destinatario" VARCHAR(20) NOT NULL,
    "referencia" VARCHAR(20) NOT NULL,
    "telefone" VARCHAR(20),
    "status" VARCHAR(20) NOT NULL,
    "motivo" VARCHAR(30),
    "provider" VARCHAR(30),
    "provider_message_id" VARCHAR(255),
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "whatsapp_envios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_clinicos" (
    "id" CHAR(36) NOT NULL,
    "agendamento_id" CHAR(36) NOT NULL,
    "pet_id" CHAR(36) NOT NULL,
    "veterinario_id" CHAR(36) NOT NULL,
    "queixa" TEXT,
    "diagnostico" TEXT,
    "tratamento" TEXT,
    "peso_kg" DECIMAL(6,2),
    "vacinas_medicacoes" TEXT,
    "retorno_sugerido" VARCHAR(10),
    "plano_saude" VARCHAR(255),
    "encaminhamento" TEXT,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "registros_clinicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueios_agenda" (
    "id" CHAR(36) NOT NULL,
    "veterinario_id" CHAR(36) NOT NULL,
    "data_inicio" VARCHAR(10) NOT NULL,
    "data_fim" VARCHAR(10),
    "recorrente" SMALLINT NOT NULL DEFAULT 0,
    "dias_semana" JSONB,
    "horarios" JSONB,
    "motivo" VARCHAR(255),
    "criado_por_user_id" CHAR(36),
    "clinica_id" CHAR(36),
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "bloqueios_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes" (
    "id" CHAR(36) NOT NULL,
    "agendamento_id" CHAR(36) NOT NULL,
    "tutor_id" CHAR(36) NOT NULL,
    "veterinario_id" CHAR(36) NOT NULL,
    "estrelas" INTEGER NOT NULL,
    "comentario" TEXT,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),
    "clinica_id" CHAR(36),
    "estrelas_clinica" INTEGER,
    "comentario_clinica" TEXT,

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_plans" (
    "id" CHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "credits" INTEGER NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "currency" VARCHAR(255) NOT NULL DEFAULT 'brl',
    "stripe_price_id" VARCHAR(255),
    "active" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "credit_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" CHAR(36) NOT NULL,
    "user_id" CHAR(36),
    "tutor_id" CHAR(36),
    "veterinario_id" CHAR(36),
    "type" "PaymentType" NOT NULL,
    "provider" VARCHAR(255) NOT NULL DEFAULT 'stripe',
    "checkout_session_id" VARCHAR(255),
    "provider_payment_intent_id" VARCHAR(255),
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(255) NOT NULL DEFAULT 'brl',
    "status" VARCHAR(255) NOT NULL DEFAULT 'pending',
    "metadata" TEXT,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credits_ledger" (
    "id" CHAR(36) NOT NULL,
    "veterinario_id" CHAR(36) NOT NULL,
    "payment_id" CHAR(36),
    "delta_credits" INTEGER NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "meta" TEXT,
    "created_at" TIMESTAMP(0),

    CONSTRAINT "credits_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" SERIAL NOT NULL,
    "provider" VARCHAR(255) NOT NULL,
    "event_id" VARCHAR(255) NOT NULL,
    "type" VARCHAR(255) NOT NULL,
    "payload" TEXT NOT NULL,
    "processed_at" TIMESTAMP(0),
    "created_at" TIMESTAMP(0),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" CHAR(36) NOT NULL,
    "tutor_id" CHAR(36),
    "veterinario_id" CHAR(36),
    "clinica_id" CHAR(36),
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" CHAR(36) NOT NULL,
    "user_id" CHAR(36),
    "type" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" SMALLINT DEFAULT 0,
    "action_data" JSONB,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" CHAR(36) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "target_type" VARCHAR(255) NOT NULL DEFAULT 'veterinario',
    "price_cents" INTEGER NOT NULL,
    "currency" VARCHAR(255) DEFAULT 'brl',
    "cycle" VARCHAR(255),
    "monthly_appointment_limit" INTEGER,
    "features" JSONB,
    "search_priority" INTEGER DEFAULT 0,
    "trial_days" INTEGER DEFAULT 0,
    "active" SMALLINT DEFAULT 1,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" CHAR(36) NOT NULL,
    "veterinario_id" CHAR(36),
    "clinica_id" CHAR(36),
    "plan_id" CHAR(36) NOT NULL,
    "asaas_subscription_id" VARCHAR(255),
    "asaas_customer_id" VARCHAR(255),
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "billing_type" VARCHAR(50),
    "current_period_start" TIMESTAMP(0),
    "current_period_end" TIMESTAMP(0),
    "trial_end" TIMESTAMP(0),
    "canceled_at" TIMESTAMP(0),
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(255),
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(0) NOT NULL,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_user_type_idx" ON "users"("user_type");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_cep_idx" ON "users"("cep");

-- CreateIndex
CREATE INDEX "users_cidade_idx" ON "users"("cidade");

-- CreateIndex
CREATE INDEX "users_ativo_idx" ON "users"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "tutores_cpf_key" ON "tutores"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "veterinarios_crmv_key" ON "veterinarios"("crmv");

-- CreateIndex
CREATE UNIQUE INDEX "clinicas_cnpj_key" ON "clinicas"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "especialidades_nome_key" ON "especialidades"("nome");

-- CreateIndex
CREATE INDEX "veterinario_clinicas_veterinario_id_idx" ON "veterinario_clinicas"("veterinario_id");

-- CreateIndex
CREATE INDEX "veterinario_clinicas_clinica_id_idx" ON "veterinario_clinicas"("clinica_id");

-- CreateIndex
CREATE INDEX "veterinario_clinicas_ativo_idx" ON "veterinario_clinicas"("ativo");

-- CreateIndex
CREATE INDEX "especialidade_relacionamentos_entidade_id_idx" ON "especialidade_relacionamentos"("entidade_id");

-- CreateIndex
CREATE INDEX "especialidade_relacionamentos_especialidade_id_idx" ON "especialidade_relacionamentos"("especialidade_id");

-- CreateIndex
CREATE INDEX "especialidade_relacionamentos_ativo_idx" ON "especialidade_relacionamentos"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "diferenciais_nome_key" ON "diferenciais"("nome");

-- CreateIndex
CREATE INDEX "clinica_diferenciais_clinica_id_idx" ON "clinica_diferenciais"("clinica_id");

-- CreateIndex
CREATE INDEX "clinica_diferenciais_diferencial_id_idx" ON "clinica_diferenciais"("diferencial_id");

-- CreateIndex
CREATE INDEX "clinica_diferenciais_ativo_idx" ON "clinica_diferenciais"("ativo");

-- CreateIndex
CREATE INDEX "experiencias_veterinarios_veterinario_id_idx" ON "experiencias_veterinarios"("veterinario_id");

-- CreateIndex
CREATE INDEX "experiencias_veterinarios_ativo_idx" ON "experiencias_veterinarios"("ativo");

-- CreateIndex
CREATE INDEX "veterinario_enderecos_veterinario_id_idx" ON "veterinario_enderecos"("veterinario_id");

-- CreateIndex
CREATE INDEX "veterinario_enderecos_cidade_idx" ON "veterinario_enderecos"("cidade");

-- CreateIndex
CREATE INDEX "veterinario_enderecos_estado_idx" ON "veterinario_enderecos"("estado");

-- CreateIndex
CREATE INDEX "veterinario_enderecos_ativo_idx" ON "veterinario_enderecos"("ativo");

-- CreateIndex
CREATE INDEX "agendamento_google_eventos_user_id_idx" ON "agendamento_google_eventos"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "agendamento_google_eventos_agendamento_user_key" ON "agendamento_google_eventos"("agendamento_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "agendamento_anotacoes_agendamento_id_key" ON "agendamento_anotacoes"("agendamento_id");

-- CreateIndex
CREATE INDEX "agendamento_anotacoes_veterinario_id_idx" ON "agendamento_anotacoes"("veterinario_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_envios_idempotencia_key" ON "whatsapp_envios"("agendamento_id", "evento", "destinatario", "referencia");

-- CreateIndex
CREATE UNIQUE INDEX "registros_clinicos_agendamento_id_key" ON "registros_clinicos"("agendamento_id");

-- CreateIndex
CREATE INDEX "registros_clinicos_pet_id_idx" ON "registros_clinicos"("pet_id");

-- CreateIndex
CREATE INDEX "bloqueios_agenda_veterinario_id_data_inicio_data_fim_idx" ON "bloqueios_agenda"("veterinario_id", "data_inicio", "data_fim");

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_agendamento_id_key" ON "avaliacoes"("agendamento_id");

-- CreateIndex
CREATE INDEX "idx_avaliacoes_veterinario" ON "avaliacoes"("veterinario_id");

-- CreateIndex
CREATE INDEX "idx_avaliacoes_tutor" ON "avaliacoes"("tutor_id");

-- CreateIndex
CREATE INDEX "idx_avaliacoes_clinica" ON "avaliacoes"("clinica_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_event_id_key" ON "webhook_events"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_tutor_id_veterinario_id_key" ON "favorites"("tutor_id", "veterinario_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_tutor_id_clinica_id_key" ON "favorites"("tutor_id", "clinica_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- AddForeignKey
ALTER TABLE "tutores" ADD CONSTRAINT "tutores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veterinarios" ADD CONSTRAINT "veterinarios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinicas" ADD CONSTRAINT "clinicas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veterinario_clinicas" ADD CONSTRAINT "veterinario_clinicas_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "veterinarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veterinario_clinicas" ADD CONSTRAINT "veterinario_clinicas_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especialidade_relacionamentos" ADD CONSTRAINT "especialidade_relacionamentos_especialidade_id_fkey" FOREIGN KEY ("especialidade_id") REFERENCES "especialidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinica_diferenciais" ADD CONSTRAINT "clinica_diferenciais_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinica_diferenciais" ADD CONSTRAINT "clinica_diferenciais_diferencial_id_fkey" FOREIGN KEY ("diferencial_id") REFERENCES "diferenciais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiencias_veterinarios" ADD CONSTRAINT "experiencias_veterinarios_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "veterinarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veterinario_enderecos" ADD CONSTRAINT "veterinario_enderecos_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "veterinarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veterinario_enderecos" ADD CONSTRAINT "veterinario_enderecos_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veterinario_planos" ADD CONSTRAINT "veterinario_planos_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "veterinarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veterinario_planos" ADD CONSTRAINT "veterinario_planos_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinica_planos" ADD CONSTRAINT "clinica_planos_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinica_planos" ADD CONSTRAINT "clinica_planos_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "veterinarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento_google_eventos" ADD CONSTRAINT "agendamento_google_eventos_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento_google_eventos" ADD CONSTRAINT "agendamento_google_eventos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento_anotacoes" ADD CONSTRAINT "agendamento_anotacoes_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_envios" ADD CONSTRAINT "whatsapp_envios_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_clinicos" ADD CONSTRAINT "registros_clinicos_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_clinicos" ADD CONSTRAINT "registros_clinicos_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueios_agenda" ADD CONSTRAINT "bloqueios_agenda_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "veterinarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "veterinarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "veterinarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits_ledger" ADD CONSTRAINT "credits_ledger_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "veterinarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits_ledger" ADD CONSTRAINT "credits_ledger_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "veterinarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "veterinarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
