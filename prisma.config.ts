import "dotenv/config";
import { defineConfig } from "prisma/config";

// O Prisma 7 não lê mais o .env sozinho. O dotenv não sobrescreve o que já está no
// ambiente: no Render (e no migrate-production.mjs) vale a variável injetada.
// process.env em vez de env(): o `prisma generate` do postinstall roda sem banco.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
