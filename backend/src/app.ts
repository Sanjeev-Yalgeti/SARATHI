import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';
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
app.use('/api/vehicles', vehiclesRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
