const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/config');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

/** Builds the Express app without listening, so tests can start it on any port. */
function createApp() {
  const app = express();

  // Behind a hosting proxy (Render, Railway…) the client IP is in X-Forwarded-For.
  app.set('trust proxy', config.isProduction ? 1 : false);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header = curl/Postman/server-to-server: not a browser CORS request.
        if (!origin || config.frontendOrigins.includes(origin)) return callback(null, true);
        return callback(null, false); // no CORS headers → the browser blocks it
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    })
  );

  app.use(express.json({ limit: config.limits.jsonBodyLimit }));

  if (config.nodeEnv === 'development') {
    app.use((req, res, next) => {
      res.on('finish', () => console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode}`));
      next();
    });
  }

  app.use('/api', routes);
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
