-- whatsapp_envios vira a fila oficial: guarda o texto para reenvio e é varrida por status na conciliação do cron.
ALTER TABLE "whatsapp_envios" ADD COLUMN IF NOT EXISTS "mensagem" TEXT;

CREATE INDEX IF NOT EXISTS "whatsapp_envios_status_updated_at_idx" ON "whatsapp_envios"("status", "updated_at");
