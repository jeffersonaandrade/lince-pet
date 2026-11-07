CREATE TYPE "PerfilAtendimento" AS ENUM ('veterinario', 'exames');

ALTER TABLE "clinicas" ADD COLUMN "perfil_atendimento" "PerfilAtendimento";
