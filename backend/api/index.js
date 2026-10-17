/**
 * Vercel serverless entry point.
 * Local development / Render / Railway still use server.js (app.listen).
 * On Vercel there is no long-running process, so we export a request handler
 * and reuse one MongoDB connection across warm invocations.
 */
const createApp = require('../app');
const { connectDatabase } = require('../config/database');

const app = createApp();
let dbReady = null;

function ensureDatabase() {
  if (!dbReady) {
    dbReady = connectDatabase().catch((err) => {
      dbReady = null; // allow a retry on the next request
      throw err;
    });
  }
  return dbReady;
}

module.exports = async (req, res) => {
  // CORS preflight does not need the database.
  if (req.method !== 'OPTIONS') {
    try {
      await ensureDatabase();
    } catch (err) {
      console.error(err.message);
      return res.status(503).json({
        success: false,
        message: 'The database is temporarily unavailable. Please try again shortly.',
        error: 'SERVICE_UNAVAILABLE',
      });
    }
  }
  return app(req, res);
};
