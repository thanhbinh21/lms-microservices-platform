require('dotenv').config();
const app = require('./app');
const prisma = require('./utils/prisma');

const PORT = Number(process.env.PORT || 3006);
const LISTEN_PORT = Number(process.env.LISTEN_PORT || PORT);

const server = app.listen(LISTEN_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`instructor-service running on port ${LISTEN_PORT}`);
});

async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}. Shutting down instructor-service...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
