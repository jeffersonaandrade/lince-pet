-- DropForeignKey
ALTER TABLE `avaliacoes` DROP FOREIGN KEY `avaliacoes_veterinario_id_fkey`;

-- AlterTable
ALTER TABLE `users` MODIFY `user_type` ENUM('tutor', 'veterinario', 'clinica', 'prestador') NOT NULL;

-- AlterTable
ALTER TABLE `agendamentos` ADD COLUMN `fim_em` DATETIME(0) NULL,
    ADD COLUMN `inicio_em` DATETIME(0) NULL,
    ADD COLUMN `prestador_id` CHAR(36) NULL,
    ADD COLUMN `servico_oferecido_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `bloqueios_agenda` ADD COLUMN `prestador_id` CHAR(36) NULL,
    MODIFY `veterinario_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `avaliacoes` ADD COLUMN `prestador_id` CHAR(36) NULL,
    MODIFY `veterinario_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `payments` ADD COLUMN `prestador_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `favorites` ADD COLUMN `prestador_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `subscriptions` ADD COLUMN `prestador_id` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `tipos_servico` (
    `id` CHAR(36) NOT NULL,
    `slug` VARCHAR(50) NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `descricao` VARCHAR(255) NULL,
    `modalidade` VARCHAR(20) NOT NULL DEFAULT 'duracao',
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `ativo` TINYINT NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `tipos_servico_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prestadores` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `tipo_servico_id` CHAR(36) NOT NULL,
    `cpf` VARCHAR(14) NULL,
    `cnpj` VARCHAR(18) NULL,
    `bio` TEXT NULL,
    `foto_url` VARCHAR(1024) NULL,
    `atende_domicilio` TINYINT NOT NULL DEFAULT 1,
    `atende_local_proprio` TINYINT NOT NULL DEFAULT 0,
    `raio_km` INTEGER NULL,
    `horarios` JSON NULL,
    `onboarding_step` INTEGER NOT NULL DEFAULT 1,
    `onboarding_complete` TINYINT NOT NULL DEFAULT 0,
    `subscription_plan_code` VARCHAR(50) NULL DEFAULT 'free',
    `monthly_appointments_used` INTEGER NULL DEFAULT 0,
    `monthly_appointments_reset_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `prestadores_user_id_idx`(`user_id`),
    INDEX `prestadores_tipo_servico_id_idx`(`tipo_servico_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `servicos_oferecidos` (
    `id` CHAR(36) NOT NULL,
    `prestador_id` CHAR(36) NOT NULL,
    `nome` VARCHAR(120) NOT NULL,
    `descricao` VARCHAR(255) NULL,
    `preco` DECIMAL(10, 2) NOT NULL,
    `duracao_min` INTEGER NULL,
    `ativo` TINYINT NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `servicos_oferecidos_prestador_id_idx`(`prestador_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `agendamentos_prestador_id_inicio_em_idx` ON `agendamentos`(`prestador_id`, `inicio_em`);

-- CreateIndex
CREATE INDEX `bloqueios_agenda_prestador_id_data_inicio_data_fim_idx` ON `bloqueios_agenda`(`prestador_id`, `data_inicio`, `data_fim`);

-- CreateIndex
CREATE INDEX `avaliacoes_prestador_id_idx` ON `avaliacoes`(`prestador_id`);

-- CreateIndex
CREATE INDEX `payments_prestador_id_idx` ON `payments`(`prestador_id`);

-- CreateIndex
CREATE UNIQUE INDEX `favorites_tutor_id_prestador_id_key` ON `favorites`(`tutor_id`, `prestador_id`);

-- CreateIndex
CREATE INDEX `subscriptions_prestador_id_idx` ON `subscriptions`(`prestador_id`);

-- AddForeignKey
ALTER TABLE `prestadores` ADD CONSTRAINT `prestadores_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prestadores` ADD CONSTRAINT `prestadores_tipo_servico_id_fkey` FOREIGN KEY (`tipo_servico_id`) REFERENCES `tipos_servico`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `servicos_oferecidos` ADD CONSTRAINT `servicos_oferecidos_prestador_id_fkey` FOREIGN KEY (`prestador_id`) REFERENCES `prestadores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_prestador_id_fkey` FOREIGN KEY (`prestador_id`) REFERENCES `prestadores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_servico_oferecido_id_fkey` FOREIGN KEY (`servico_oferecido_id`) REFERENCES `servicos_oferecidos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bloqueios_agenda` ADD CONSTRAINT `bloqueios_agenda_prestador_id_fkey` FOREIGN KEY (`prestador_id`) REFERENCES `prestadores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `avaliacoes` ADD CONSTRAINT `avaliacoes_veterinario_id_fkey` FOREIGN KEY (`veterinario_id`) REFERENCES `veterinarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `avaliacoes` ADD CONSTRAINT `avaliacoes_prestador_id_fkey` FOREIGN KEY (`prestador_id`) REFERENCES `prestadores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_prestador_id_fkey` FOREIGN KEY (`prestador_id`) REFERENCES `prestadores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_prestador_id_fkey` FOREIGN KEY (`prestador_id`) REFERENCES `prestadores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_prestador_id_fkey` FOREIGN KEY (`prestador_id`) REFERENCES `prestadores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Catálogo inicial de tipos de serviço (o seed faz upsert pelo slug)
INSERT IGNORE INTO `tipos_servico` (`id`, `slug`, `nome`, `descricao`, `modalidade`, `ordem`, `ativo`, `created_at`, `updated_at`) VALUES
    (UUID(), 'tosador', 'Banho e tosa', 'Banho, tosa e higiene', 'duracao', 1, 1, NOW(), NOW()),
    (UUID(), 'passeador', 'Passeador', 'Passeios com o pet', 'duracao', 2, 1, NOW(), NOW()),
    (UUID(), 'adestrador', 'Adestrador', 'Aulas de adestramento e comportamento', 'duracao', 3, 1, NOW(), NOW()),
    (UUID(), 'pet_sitter', 'Pet sitter', 'Hospedagem e cuidado do pet por período', 'periodo', 4, 1, NOW(), NOW());
