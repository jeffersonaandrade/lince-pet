ALTER TABLE "users" ADD COLUMN "redefinicao_senha_obrigatoria" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "recuperacoes_cnpj" ADD COLUMN "faturamento_conferido" BOOLEAN NOT NULL DEFAULT false;
