import 'dotenv/config';
import { createServer } from 'node:http';
import app from './app.js';
import { startSimulation, stopSimulation } from './services/simulation.service.js';
import { initSockets } from './sockets/index.js';

const PORT = Number(process.env['PORT']) || 5000;

const httpServer = createServer(app);
initSockets(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  void startSimulation();
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down…`);
  stopSimulation();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
