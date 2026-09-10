import { Router, type Request, type Response } from 'express';
import { predictRisk } from '../services/risk.service.js';
import { getWeather } from '../services/weather.service.js';

const router = Router();
function coordinate(value: unknown): number | null { const n = Number(value); return Number.isFinite(n) ? n : null; }

router.get('/weather', async (req: Request, res: Response) => {
  const lat = coordinate(req.query['lat']), lng = coordinate(req.query['lng']);
  if (lat === null || lng === null) return void res.status(400).json({ error: 'lat and lng must be numbers' });
  res.json(await getWeather(lat, lng));
});

router.get('/risk', async (req: Request, res: Response) => {
  const lat = coordinate(req.query['lat']), lng = coordinate(req.query['lng']);
  const eventDate = typeof req.query['date'] === 'string' ? req.query['date'] : new Date().toISOString().slice(0, 10);
  if (lat === null || lng === null || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return void res.status(400).json({ error: 'lat, lng and YYYY-MM-DD date are required' });
  res.json(await predictRisk({ lat, lng, eventDate }));
});
export default router;
