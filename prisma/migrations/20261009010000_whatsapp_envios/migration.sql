-- AlterTable
ALTER TABLE `tutores` ADD COLUMN `whatsapp_opt_in` TINYINT NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE `whatsapp_envios` (
    `id` CHAR(36) NOT NULL,
    `agendamento_id` CHAR(36) NULL,
    `evento` VARCHAR(30) NOT NULL,
    `destinatario` VARCHAR(20) NOT NULL,
    `referencia` VARCHAR(20) NOT NULL,
    `telefone` VARCHAR(20) NULL,
    `status` VARCHAR(20) NOT NULL,
    `motivo` VARCHAR(30) NULL,
    `provider` VARCHAR(30) NULL,
    `provider_message_id` VARCHAR(255) NULL,
    `tentativas` INTEGER NOT NULL DEFAULT 0,
    `erro` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `whatsapp_envios_idempotencia_key`(`agendamento_id`, `evento`, `destinatario`, `referencia`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `whatsapp_envios` ADD CONSTRAINT `whatsapp_envios_agendamento_id_fkey` FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
