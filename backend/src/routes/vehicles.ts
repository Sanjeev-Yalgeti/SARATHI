import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { trucks, type Truck } from '../services/trucks.js';
import { truckCorridor } from '../services/simulation.service.js';
import { ownTruck } from '../utils/scope.js';

const router = Router();
router.use(authenticate);

// GET /api/vehicles -> admin: all trucks, driver: own truck only.
// Each truck carries its story corridor (depot → via → destination) so the
// LiveMap can draw one line per truck instead of one line per city-pair.
router.get('/', (req: Request, res: Response) => {
  const withCorridor = (t: Truck) => ({
    ...t,
    corridor: truckCorridor(t.vehicleId),
  });
  if (req.user?.role === 'ADMIN') {
    res.json({ vehicles: [...trucks.values()].map(withCorridor) });
    return;
  }
  const truck = ownTruck(req);
  if (!truck) {
    res.status(404).json({ error: 'No vehicle assigned to this driver' });
    return;
  }
  res.json({ vehicles: [withCorridor(truck)] });
});

export default router;
