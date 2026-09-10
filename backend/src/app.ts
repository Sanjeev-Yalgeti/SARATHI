import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRouter from './routes/auth.js';
import bulletinRouter from './routes/bulletin.js';
import healthRouter from './routes/health.js';
import incidentsRouter from './routes/incidents.js';
import intelligenceRouter from './routes/intelligence.js';
import reportsRouter from './routes/reports.js';
import routesRouter from './routes/routes.js';
import tripsRouter from './routes/trips.js';
import vehiclesRouter from './routes/vehicles.js';

const app = express();

// CORS first so the Vite map (CORS_ORIGIN) can reach the API.
const corsOrigin = process.env['CORS_ORIGIN'];
app.use(
  cors({
    origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
  })
);
app.use(helmet());
app.use(morgan('dev'));

app.use(express.json({ limit: '1mb' }));

// Field-report photos land here (served for the map + bulletin).
app.use('/uploads', express.static(join(dirname(fileURLToPath(import.meta.url)), '..', 'uploads')));

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter); // public — login lives here
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api', intelligenceRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/routes', routesRouter);
app.use('/api/trips', tripsRouter);
// Canonical endpoint documented for the dashboard. Keep `/api/routes/analyze`
// working as a compatibility alias while clients move to this singular form.
app.use('/api/route', routesRouter);
app.use('/api/bulletin.pdf', bulletinRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
