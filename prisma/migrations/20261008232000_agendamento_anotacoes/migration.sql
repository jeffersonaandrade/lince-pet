-- CreateTable
CREATE TABLE `agendamento_anotacoes` (
    `id` CHAR(36) NOT NULL,
    `agendamento_id` CHAR(36) NOT NULL,
    `veterinario_id` CHAR(36) NOT NULL,
    `local_atendimento` VARCHAR(255) NULL,
    `status_pagamento` VARCHAR(20) NULL,
    `forma_pagamento` VARCHAR(30) NULL,
    `plano_nome` VARCHAR(255) NULL,
    `observacoes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `agendamento_anotacoes_agendamento_id_key`(`agendamento_id`),
    INDEX `agendamento_anotacoes_veterinario_id_idx`(`veterinario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `agendamento_anotacoes` ADD CONSTRAINT `agendamento_anotacoes_agendamento_id_fkey` FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
