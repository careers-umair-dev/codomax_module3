const config = require('./config/config');
const createApp = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/database');

let server;

/** The HTTP server only starts once MongoDB is reachable. */
async function start() {
  await connectDatabase();
  console.log('Connected to MongoDB');

  const app = createApp();
  server = app.listen(config.port, () => {
    console.log(`Quill API listening on port ${config.port} (${config.nodeEnv})`);
    console.log(`Allowed frontend origin(s): ${config.frontendOrigins.join(', ')}`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received, shutting down…`);
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((err) => {
  console.error(err.message);
  console.error('Check MONGODB_URI, your Atlas database user, and that your IP is allowed under Network Access.');
  process.exit(1);
});
