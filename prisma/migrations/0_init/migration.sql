-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `user_type` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(255) NOT NULL,
    `celular` VARCHAR(15) NULL,
    `cep` VARCHAR(8) NULL,
    `rua` VARCHAR(255) NULL,
    `cidade` VARCHAR(100) NULL,
    `estado` VARCHAR(2) NULL,
    `ativo` TINYINT NULL DEFAULT 1,
    `is_email_verified` TINYINT NULL DEFAULT 0,
    `profile_pic` VARCHAR(500) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `sobrenome` VARCHAR(100) NULL,
    `numero` VARCHAR(10) NULL,
    `bairro` VARCHAR(100) NULL,
    `google_access_token` TEXT NULL,
    `google_refresh_token` TEXT NULL,
    `google_token_expires_at` TIMESTAMP(0) NULL,
    `google_calendar_authorized` TINYINT NULL DEFAULT 0,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_user_type_idx`(`user_type`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_cep_idx`(`cep`),
    INDEX `users_cidade_idx`(`cidade`),
    INDEX `users_ativo_idx`(`ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tutores` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `cpf` VARCHAR(14) NULL,
    `genero` VARCHAR(191) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `tutores_cpf_key`(`cpf`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `veterinarios` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `cpf` VARCHAR(14) NULL,
    `cnpj` VARCHAR(18) NULL,
    `genero` VARCHAR(191) NULL,
    `crmv` VARCHAR(15) NULL,
    `bio` TEXT NULL,
    `foto_url` VARCHAR(1024) NULL,
    `atende_presencial` TINYINT NULL DEFAULT 0,
    `atende_online` TINYINT NULL DEFAULT 0,
    `atende_domicilio` TINYINT NULL DEFAULT 0,
    `preco_consulta` DECIMAL(10, 2) NULL,
    `onboarding_complete` TINYINT NULL DEFAULT 0,
    `onboarding_step` INTEGER NULL DEFAULT 1,
    `is_verified` TINYINT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `creditos` INTEGER NOT NULL DEFAULT 0,
    `preco_consulta_online` DECIMAL(10, 2) NULL,
    `horarios_online` JSON NULL,
    `subscription_plan_code` VARCHAR(50) NULL DEFAULT 'pro',
    `monthly_appointments_used` INTEGER NULL DEFAULT 0,
    `monthly_appointments_reset_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `veterinarios_crmv_key`(`crmv`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clinicas` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `cnpj` VARCHAR(18) NULL,
    `descricao` TEXT NULL,
    `horarios_funcionamento` JSON NULL,
    `quantidade_vets` VARCHAR(10) NULL,
    `onboarding_complete` TINYINT NULL DEFAULT 0,
    `is_verified` TINYINT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `nome_clinica` VARCHAR(200) NULL,
    `tipo_clinica` VARCHAR(191) NULL DEFAULT 'solo',
    `nome_fantasia` VARCHAR(255) NULL,
    `razao_social` VARCHAR(255) NULL,
    `endereco` VARCHAR(255) NULL,
    `cep` VARCHAR(10) NULL,
    `cidade` VARCHAR(255) NULL,
    `estado` VARCHAR(2) NULL,
    `latitude` VARCHAR(255) NULL,
    `longitude` VARCHAR(255) NULL,
    `telefone` VARCHAR(255) NULL,
    `whatsapp` VARCHAR(255) NULL,
    `horario_funcionamento` JSON NULL,
    `comodidades` JSON NULL,
    `foto_perfil` VARCHAR(255) NULL,
    `foto_capa` VARCHAR(255) NULL,
    `sobre` TEXT NULL,
    `subscription_plan_code` VARCHAR(255) NULL DEFAULT 'free',

    UNIQUE INDEX `clinicas_cnpj_key`(`cnpj`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `especialidades` (
    `id` CHAR(36) NOT NULL,
    `nome` VARCHAR(255) NOT NULL,
    `descricao` TEXT NULL,
    `ativo` TINYINT NULL DEFAULT 1,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `especialidades_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `veterinario_clinicas` (
    `veterinario_id` CHAR(36) NOT NULL,
    `clinica_id` CHAR(36) NOT NULL,
    `ativo` TINYINT NULL DEFAULT 1,
    `status` VARCHAR(255) NULL DEFAULT 'pendente',
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `veterinario_clinicas_veterinario_id_idx`(`veterinario_id`),
    INDEX `veterinario_clinicas_clinica_id_idx`(`clinica_id`),
    INDEX `veterinario_clinicas_ativo_idx`(`ativo`),
    PRIMARY KEY (`veterinario_id`, `clinica_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `especialidade_relacionamentos` (
    `entidade_id` CHAR(36) NOT NULL,
    `especialidade_id` CHAR(36) NOT NULL,
    `ativo` TINYINT NULL DEFAULT 1,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `entidade_tipo` VARCHAR(20) NOT NULL DEFAULT 'veterinario',

    INDEX `especialidade_relacionamentos_entidade_id_idx`(`entidade_id`),
    INDEX `especialidade_relacionamentos_especialidade_id_idx`(`especialidade_id`),
    INDEX `especialidade_relacionamentos_ativo_idx`(`ativo`),
    PRIMARY KEY (`entidade_id`, `especialidade_id`, `entidade_tipo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `diferenciais` (
    `id` CHAR(36) NOT NULL,
    `nome` VARCHAR(255) NOT NULL,
    `icone` VARCHAR(255) NULL,
    `descricao` TEXT NULL,
    `ativo` TINYINT NULL DEFAULT 1,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `diferenciais_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clinica_diferenciais` (
    `clinica_id` CHAR(36) NOT NULL,
    `diferencial_id` CHAR(36) NOT NULL,
    `ativo` TINYINT NULL DEFAULT 1,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `clinica_diferenciais_clinica_id_idx`(`clinica_id`),
    INDEX `clinica_diferenciais_diferencial_id_idx`(`diferencial_id`),
    INDEX `clinica_diferenciais_ativo_idx`(`ativo`),
    PRIMARY KEY (`clinica_id`, `diferencial_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experiencias_veterinarios` (
    `id` CHAR(36) NOT NULL,
    `veterinario_id` CHAR(36) NOT NULL,
    `local` VARCHAR(255) NOT NULL,
    `cargo` VARCHAR(255) NOT NULL,
    `data_inicio` DATE NULL,
    `data_fim` DATE NULL,
    `descricao` TEXT NULL,
    `ativo` TINYINT NULL DEFAULT 1,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `experiencias_veterinarios_veterinario_id_idx`(`veterinario_id`),
    INDEX `experiencias_veterinarios_ativo_idx`(`ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `veterinario_enderecos` (
    `id` CHAR(36) NOT NULL,
    `veterinario_id` CHAR(36) NOT NULL,
    `rua` VARCHAR(255) NOT NULL,
    `numero` VARCHAR(20) NOT NULL,
    `bairro` VARCHAR(100) NULL,
    `complemento` VARCHAR(100) NULL,
    `cidade` VARCHAR(100) NOT NULL,
    `estado` VARCHAR(2) NOT NULL,
    `cep` VARCHAR(8) NOT NULL,
    `horarios_funcionamento` JSON NULL,
    `horarios_disponibilidade` JSON NULL,
    `aceita_emergencia` TINYINT NULL DEFAULT 0,
    `observacoes` TEXT NULL,
    `is_primary` TINYINT NULL DEFAULT 0,
    `ativo` TINYINT NULL DEFAULT 1,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `preco_consulta` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `nome_clinica` VARCHAR(255) NULL,
    `foto_url` VARCHAR(255) NULL,
    `clinica_id` CHAR(36) NULL,

    INDEX `veterinario_enderecos_veterinario_id_idx`(`veterinario_id`),
    INDEX `veterinario_enderecos_cidade_idx`(`cidade`),
    INDEX `veterinario_enderecos_estado_idx`(`estado`),
    INDEX `veterinario_enderecos_ativo_idx`(`ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `planos` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `image` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `veterinario_planos` (
    `veterinario_id` CHAR(36) NOT NULL,
    `plano_id` CHAR(36) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`veterinario_id`, `plano_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clinica_planos` (
    `clinica_id` CHAR(36) NOT NULL,
    `plano_id` CHAR(36) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`clinica_id`, `plano_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pets` (
    `id` CHAR(36) NOT NULL,
    `tutor_id` CHAR(36) NULL,
    `nome` VARCHAR(255) NOT NULL,
    `especie` VARCHAR(255) NOT NULL,
    `raca` VARCHAR(255) NULL,
    `idade` INTEGER UNSIGNED NULL,
    `foto_url` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `porte` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agendamentos` (
    `id` CHAR(36) NOT NULL,
    `tutor_id` CHAR(36) NULL,
    `pet_id` CHAR(36) NULL,
    `veterinario_id` CHAR(36) NULL,
    `data_consulta` VARCHAR(255) NULL,
    `horario_consulta` VARCHAR(255) NULL,
    `status` VARCHAR(255) NOT NULL,
    `tipo_consulta` VARCHAR(255) NULL,
    `preco_consulta` DECIMAL(8, 2) NULL,
    `observacoes` VARCHAR(255) NULL,
    `motivo_cancelamento` VARCHAR(255) NULL,
    `confirmado_em` VARCHAR(255) NULL,
    `cancelado_em` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `start_code` VARCHAR(12) NULL,
    `start_code_expires_at` TIMESTAMP(0) NULL,
    `start_code_used_at` TIMESTAMP(0) NULL,
    `start_code_attempts` INTEGER NOT NULL DEFAULT 0,
    `started_at` TIMESTAMP(0) NULL,
    `ended_at` TIMESTAMP(0) NULL,
    `payment_status` VARCHAR(255) NOT NULL DEFAULT 'unpaid',
    `provider_payment_id` VARCHAR(255) NULL,
    `local_nome` VARCHAR(255) NULL,
    `local_endereco` VARCHAR(255) NULL,
    `clinica_id` CHAR(36) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `avaliacoes` (
    `id` CHAR(36) NOT NULL,
    `agendamento_id` CHAR(36) NOT NULL,
    `tutor_id` CHAR(36) NOT NULL,
    `veterinario_id` CHAR(36) NOT NULL,
    `estrelas` INTEGER NOT NULL,
    `comentario` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `clinica_id` CHAR(36) NULL,
    `estrelas_clinica` INTEGER NULL,
    `comentario_clinica` TEXT NULL,

    UNIQUE INDEX `avaliacoes_agendamento_id_key`(`agendamento_id`),
    INDEX `idx_avaliacoes_veterinario`(`veterinario_id`),
    INDEX `idx_avaliacoes_tutor`(`tutor_id`),
    INDEX `idx_avaliacoes_clinica`(`clinica_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `credit_plans` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `credits` INTEGER NOT NULL,
    `price_cents` INTEGER NOT NULL,
    `currency` VARCHAR(255) NOT NULL DEFAULT 'brl',
    `stripe_price_id` VARCHAR(255) NULL,
    `active` TINYINT NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `tutor_id` CHAR(36) NULL,
    `veterinario_id` CHAR(36) NULL,
    `type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(255) NOT NULL DEFAULT 'stripe',
    `checkout_session_id` VARCHAR(255) NULL,
    `provider_payment_intent_id` VARCHAR(255) NULL,
    `amount_cents` INTEGER NOT NULL,
    `currency` VARCHAR(255) NOT NULL DEFAULT 'brl',
    `status` VARCHAR(255) NOT NULL DEFAULT 'pending',
    `metadata` LONGTEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `credits_ledger` (
    `id` CHAR(36) NOT NULL,
    `veterinario_id` CHAR(36) NOT NULL,
    `payment_id` CHAR(36) NULL,
    `delta_credits` INTEGER NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `meta` LONGTEXT NULL,
    `created_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_events` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(255) NOT NULL,
    `event_id` VARCHAR(255) NOT NULL,
    `type` VARCHAR(255) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `processed_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `webhook_events_event_id_key`(`event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `favorites` (
    `id` CHAR(36) NOT NULL,
    `tutor_id` CHAR(36) NULL,
    `veterinario_id` CHAR(36) NULL,
    `clinica_id` CHAR(36) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `favorites_tutor_id_veterinario_id_key`(`tutor_id`, `veterinario_id`),
    UNIQUE INDEX `favorites_tutor_id_clinica_id_key`(`tutor_id`, `clinica_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `type` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `is_read` TINYINT NULL DEFAULT 0,
    `action_data` JSON NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `notifications_user_id_idx`(`user_id`),
    INDEX `notifications_is_read_idx`(`is_read`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_plans` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `target_type` VARCHAR(255) NOT NULL DEFAULT 'veterinario',
    `price_cents` INTEGER NOT NULL,
    `currency` VARCHAR(255) NULL DEFAULT 'brl',
    `cycle` VARCHAR(255) NULL,
    `monthly_appointment_limit` INTEGER NULL,
    `features` JSON NULL,
    `search_priority` INTEGER NULL DEFAULT 0,
    `trial_days` INTEGER NULL DEFAULT 0,
    `active` TINYINT NULL DEFAULT 1,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `subscription_plans_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` CHAR(36) NOT NULL,
    `veterinario_id` CHAR(36) NULL,
    `clinica_id` CHAR(36) NULL,
    `plan_id` CHAR(36) NOT NULL,
    `asaas_subscription_id` VARCHAR(255) NULL,
    `asaas_customer_id` VARCHAR(255) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'active',
    `billing_type` VARCHAR(50) NULL,
    `current_period_start` TIMESTAMP(0) NULL,
    `current_period_end` TIMESTAMP(0) NULL,
    `trial_end` TIMESTAMP(0) NULL,
    `canceled_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(255) NULL,
    `token` VARCHAR(255) NOT NULL,
    `expires_at` TIMESTAMP(0) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `password_reset_tokens_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tutores` ADD CONSTRAINT `tutores_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `veterinarios` ADD CONSTRAINT `veterinarios_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clinicas` ADD CONSTRAINT `clinicas_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `veterinario_clinicas` ADD CONSTRAINT `veterinario_clinicas_veterinario_id_fkey` FOREIGN KEY (`veterinario_id`) REFERENCES `veterinarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `veterinario_clinicas` ADD CONSTRAINT `veterinario_clinicas_clinica_id_fkey` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `especialidade_relacionamentos` ADD CONSTRAINT `especialidade_relacionamentos_especialidade_id_fkey` FOREIGN KEY (`especialidade_id`) REFERENCES `especialidades`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clinica_diferenciais` ADD CONSTRAINT `clinica_diferenciais_clinica_id_fkey` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clinica_diferenciais` ADD CONSTRAINT `clinica_diferenciais_diferencial_id_fkey` FOREIGN KEY (`diferencial_id`) REFERENCES `diferenciais`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experiencias_veterinarios` ADD CONSTRAINT `experiencias_veterinarios_veterinario_id_fkey` FOREIGN KEY (`veterinario_id`) REFERENCES `veterinarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `veterinario_enderecos` ADD CONSTRAINT `veterinario_enderecos_veterinario_id_fkey` FOREIGN KEY (`veterinario_id`) REFERENCES `veterinarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `veterinario_enderecos` ADD CONSTRAINT `veterinario_enderecos_clinica_id_fkey` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `veterinario_planos` ADD CONSTRAINT `veterinario_planos_veterinario_id_fkey` FOREIGN KEY (`veterinario_id`) REFERENCES `veterinarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `veterinario_planos` ADD CONSTRAINT `veterinario_planos_plano_id_fkey` FOREIGN KEY (`plano_id`) REFERENCES `planos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clinica_planos` ADD CONSTRAINT `clinica_planos_clinica_id_fkey` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clinica_planos` ADD CONSTRAINT `clinica_planos_plano_id_fkey` FOREIGN KEY (`plano_id`) REFERENCES `planos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pets` ADD CONSTRAINT `pets_tutor_id_fkey` FOREIGN KEY (`tutor_id`) REFERENCES `tutores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_tutor_id_fkey` FOREIGN KEY (`tutor_id`) REFERENCES `tutores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_pet_id_fkey` FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_veterinario_id_fkey` FOREIGN KEY (`veterinario_id`) REFERENCES `veterinarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_clinica_id_fkey` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `avaliacoes` ADD CONSTRAINT `avaliacoes_agendamento_id_fkey` FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `avaliacoes` ADD CONSTRAINT `avaliacoes_tutor_id_fkey` FOREIGN KEY (`tutor_id`) REFERENCES `tutores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `avaliacoes` ADD CONSTRAINT `avaliacoes_veterinario_id_fkey` FOREIGN KEY (`veterinario_id`) REFERENCES `veterinarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `avaliacoes` ADD CONSTRAINT `avaliacoes_clinica_id_fkey` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_tutor_id_fkey` FOREIGN KEY (`tutor_id`) REFERENCES `tutores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_veterinario_id_fkey` FOREIGN KEY (`veterinario_id`) REFERENCES `veterinarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credits_ledger` ADD CONSTRAINT `credits_ledger_veterinario_id_fkey` FOREIGN KEY (`veterinario_id`) REFERENCES `veterinarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credits_ledger` ADD CONSTRAINT `credits_ledger_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_tutor_id_fkey` FOREIGN KEY (`tutor_id`) REFERENCES `tutores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_veterinario_id_fkey` FOREIGN KEY (`veterinario_id`) REFERENCES `veterinarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_clinica_id_fkey` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_veterinario_id_fkey` FOREIGN KEY (`veterinario_id`) REFERENCES `veterinarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_clinica_id_fkey` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
