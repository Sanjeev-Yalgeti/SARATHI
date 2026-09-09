import 'dotenv/config';
import app from './app.js';
import { startSimulation } from './services/simulation.service.js';

const PORT = Number(process.env['PORT']) || 5000;

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  void startSimulation();
});
