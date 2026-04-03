FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* ./
# --ignore-scripts: postinstall trỏ ../../scripts (monorepo) — không tồn tại trong image này.
# Prisma generate chạy ở bước RUN bên dưới.
RUN npm install --ignore-scripts

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 5006

ENV LISTEN_PORT=5006

CMD ["node", "dist/server.js"]
