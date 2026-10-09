-- CreateTable
CREATE TABLE "encaminhamentos" (
    "id" CHAR(36) NOT NULL,
    "pet_id" CHAR(36) NOT NULL,
    "tutor_id" CHAR(36) NOT NULL,
    "agendamento_origem_id" CHAR(36) NOT NULL,
    "origem_veterinario_id" CHAR(36),
    "origem_clinica_id" CHAR(36),
    "destino_tipo" VARCHAR(20) NOT NULL,
    "destino_veterinario_id" CHAR(36),
    "destino_clinica_id" CHAR(36),
    "destino_prestador_id" CHAR(36),
    "motivo" TEXT NOT NULL,
    "urgencia" VARCHAR(20) NOT NULL DEFAULT 'rotina',
    "status" VARCHAR(20) NOT NULL DEFAULT 'enviado',
    "motivo_recusa" VARCHAR(500),
    "respondido_em" TIMESTAMP(0),
    "agendamento_destino_id" CHAR(36),
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),

    CONSTRAINT "encaminhamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "encaminhamentos_agendamento_destino_id_key" ON "encaminhamentos"("agendamento_destino_id");

-- CreateIndex
CREATE INDEX "encaminhamentos_pet_id_idx" ON "encaminhamentos"("pet_id");

-- CreateIndex
CREATE INDEX "encaminhamentos_tutor_id_idx" ON "encaminhamentos"("tutor_id");

-- CreateIndex
CREATE INDEX "encaminhamentos_agendamento_origem_id_idx" ON "encaminhamentos"("agendamento_origem_id");

-- CreateIndex
CREATE INDEX "encaminhamentos_destino_veterinario_id_status_idx" ON "encaminhamentos"("destino_veterinario_id", "status");

-- CreateIndex
CREATE INDEX "encaminhamentos_destino_clinica_id_status_idx" ON "encaminhamentos"("destino_clinica_id", "status");

-- CreateIndex
CREATE INDEX "encaminhamentos_destino_prestador_id_status_idx" ON "encaminhamentos"("destino_prestador_id", "status");

-- AddForeignKey
ALTER TABLE "encaminhamentos" ADD CONSTRAINT "encaminhamentos_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamentos" ADD CONSTRAINT "encaminhamentos_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamentos" ADD CONSTRAINT "encaminhamentos_agendamento_origem_id_fkey" FOREIGN KEY ("agendamento_origem_id") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamentos" ADD CONSTRAINT "encaminhamentos_agendamento_destino_id_fkey" FOREIGN KEY ("agendamento_destino_id") REFERENCES "agendamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamentos" ADD CONSTRAINT "encaminhamentos_origem_veterinario_id_fkey" FOREIGN KEY ("origem_veterinario_id") REFERENCES "veterinarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamentos" ADD CONSTRAINT "encaminhamentos_origem_clinica_id_fkey" FOREIGN KEY ("origem_clinica_id") REFERENCES "clinicas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamentos" ADD CONSTRAINT "encaminhamentos_destino_veterinario_id_fkey" FOREIGN KEY ("destino_veterinario_id") REFERENCES "veterinarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamentos" ADD CONSTRAINT "encaminhamentos_destino_clinica_id_fkey" FOREIGN KEY ("destino_clinica_id") REFERENCES "clinicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamentos" ADD CONSTRAINT "encaminhamentos_destino_prestador_id_fkey" FOREIGN KEY ("destino_prestador_id") REFERENCES "prestadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
