FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 5006

ENV LISTEN_PORT=5006

CMD ["npm", "run", "start"]
