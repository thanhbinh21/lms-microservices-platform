FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --ignore-scripts

COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src
COPY tsconfig.json ./tsconfig.json

RUN npx prisma generate
RUN npm run build

EXPOSE 5006

ENV LISTEN_PORT=5006

CMD ["node", "dist/server.js"]
