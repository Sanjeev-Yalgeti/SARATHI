import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { errorHandler, notFound } from './middleware/errorHandler.js';
import routesRouter from './routes/routes.js';
import tripsRouter from './routes/trips.js';
import alertsRouter from './routes/alerts.js';
import geocodeRouter from './routes/geocode.js';
import mapsRouter from './routes/maps.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security & Parsing ──────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SARATHI Backend',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/routes', routesRouter); // public transport routes & schedules
app.use('/api/trips', tripsRouter); // trip planning & OSRM routing
app.use('/api/alerts', alertsRouter); // service alerts / disruptions
app.use('/api/geocode', geocodeRouter); // geocoding (Google Maps / HERE)
app.use('/api/maps', mapsRouter); // map tiles, live location helpers

// ── 404 & Error Handling ────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🚌  SARATHI backend running on http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});

export default app;
