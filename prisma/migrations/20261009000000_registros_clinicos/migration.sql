-- CreateTable
CREATE TABLE `registros_clinicos` (
    `id` CHAR(36) NOT NULL,
    `agendamento_id` CHAR(36) NOT NULL,
    `pet_id` CHAR(36) NOT NULL,
    `veterinario_id` CHAR(36) NOT NULL,
    `queixa` TEXT NULL,
    `diagnostico` TEXT NULL,
    `tratamento` TEXT NULL,
    `peso_kg` DECIMAL(6, 2) NULL,
    `vacinas_medicacoes` TEXT NULL,
    `retorno_sugerido` VARCHAR(10) NULL,
    `plano_saude` VARCHAR(255) NULL,
    `encaminhamento` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `registros_clinicos_agendamento_id_key`(`agendamento_id`),
    INDEX `registros_clinicos_pet_id_idx`(`pet_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `registros_clinicos` ADD CONSTRAINT `registros_clinicos_agendamento_id_fkey` FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registros_clinicos` ADD CONSTRAINT `registros_clinicos_pet_id_fkey` FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
