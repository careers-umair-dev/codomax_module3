const mongoose = require('mongoose');
const config = require('./config');

// Unknown query fields are dropped instead of silently matching everything.
mongoose.set('strictQuery', true);

let listenersAttached = false;

function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));
}

/**
 * Opens the single shared Mongoose connection and builds the declared indexes.
 * Rejects (with a credential-free message) if the database cannot be reached,
 * so server.js can refuse to start instead of serving a broken API.
 */
async function connectDatabase(uri = config.mongo.uri) {
  attachListeners();
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: config.mongo.serverSelectionTimeoutMS,
      bufferTimeoutMS: 5000, // queries while disconnected fail fast → 503, not a 10s hang
    });
    // Make sure unique/compound indexes exist (no-op when they already do).
    await mongoose.connection.syncIndexes();
  } catch (err) {
    // err.message can echo the host; the URI (with password) is never included by the driver.
    throw new Error(`Could not connect to MongoDB: ${err.message}`);
  }
  return mongoose.connection;
}

async function disconnectDatabase() {
  await mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase };
