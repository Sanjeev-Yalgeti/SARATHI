import express from 'express';
import healthRouter from './routes/health.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
