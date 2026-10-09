FROM node:20-alpine

WORKDIR /app

RUN npm install prisma@6.19.3

COPY prisma ./prisma

CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]
