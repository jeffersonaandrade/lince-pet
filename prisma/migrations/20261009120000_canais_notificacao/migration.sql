-- AlterTable
ALTER TABLE `users` ADD COLUMN `notificar_email` TINYINT NOT NULL DEFAULT 1,
    ADD COLUMN `notificar_whatsapp` TINYINT NOT NULL DEFAULT 1;

-- Preferência de WhatsApp do tutor passa para o usuário
UPDATE `users` u
    INNER JOIN `tutores` t ON t.`user_id` = u.`id`
    SET u.`notificar_whatsapp` = t.`whatsapp_opt_in`;

-- AlterTable
ALTER TABLE `tutores` DROP COLUMN `whatsapp_opt_in`;

-- CreateTable
CREATE TABLE `agendamento_google_eventos` (
    `id` CHAR(36) NOT NULL,
    `agendamento_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `google_event_id` VARCHAR(1024) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `agendamento_google_eventos_user_id_idx`(`user_id`),
    UNIQUE INDEX `agendamento_google_eventos_agendamento_user_key`(`agendamento_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `agendamento_google_eventos` ADD CONSTRAINT `agendamento_google_eventos_agendamento_id_fkey` FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agendamento_google_eventos` ADD CONSTRAINT `agendamento_google_eventos_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
