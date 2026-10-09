-- CreateTable
CREATE TABLE `bloqueios_agenda` (
    `id` CHAR(36) NOT NULL,
    `veterinario_id` CHAR(36) NOT NULL,
    `data_inicio` VARCHAR(10) NOT NULL,
    `data_fim` VARCHAR(10) NULL,
    `recorrente` TINYINT NOT NULL DEFAULT 0,
    `dias_semana` JSON NULL,
    `horarios` JSON NULL,
    `motivo` VARCHAR(255) NULL,
    `criado_por_user_id` CHAR(36) NULL,
    `clinica_id` CHAR(36) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `bloqueios_agenda_veterinario_id_data_inicio_data_fim_idx`(`veterinario_id`, `data_inicio`, `data_fim`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bloqueios_agenda` ADD CONSTRAINT `bloqueios_agenda_veterinario_id_fkey` FOREIGN KEY (`veterinario_id`) REFERENCES `veterinarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
