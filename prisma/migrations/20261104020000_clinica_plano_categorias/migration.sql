-- Categorias aceitas por clínica em cada plano de saúde (texto livre; ex.: Diamante, Premium).
ALTER TABLE "clinica_planos"
ADD COLUMN IF NOT EXISTS "categorias_aceitas" VARCHAR(500);
