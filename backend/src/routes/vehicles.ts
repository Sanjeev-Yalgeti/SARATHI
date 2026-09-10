import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { trucks } from '../services/trucks.js';
import { ownTruck } from '../utils/scope.js';

const router = Router();
router.use(authenticate);

// GET /api/vehicles -> admin: all trucks, driver: own truck only
router.get('/', (req: Request, res: Response) => {
  if (req.user?.role === 'ADMIN') {
    res.json({ vehicles: [...trucks.values()] });
    return;
  }
  const truck = ownTruck(req);
  if (!truck) {
    res.status(404).json({ error: 'No vehicle assigned to this driver' });
    return;
  }
  res.json({ vehicles: [truck] });
});

export default router;
