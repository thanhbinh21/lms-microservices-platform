FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 5006

ENV LISTEN_PORT=5006

CMD ["node", "dist/server.js"]
