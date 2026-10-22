FROM node:22-alpine

WORKDIR /app

RUN npm install prisma@7.10.1 dotenv

COPY prisma.config.ts ./
COPY prisma ./prisma

CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]
