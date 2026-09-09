/**
 * routes/routes.js
 * Public transport routes & schedules via GTFS.
 *
 * GET  /api/routes                        — list all routes (optionally filter by agency)
 * GET  /api/routes/:routeId/stops         — stops along a route
 * GET  /api/routes/:routeId/trips         — trips for a route
 * GET  /api/routes/:routeId/vehicles      — real-time vehicle positions on a route
 * GET  /api/routes/:routeId/trip-updates  — real-time trip updates
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as gtfs from '../services/gtfs.service.js';

const router = Router();

// List routes
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { agencyId } = req.query;
    const data = await gtfs.getRoutes(agencyId);
    res.json({ success: true, data });
  })
);

// Stops for a route
router.get(
  '/:routeId/stops',
  asyncHandler(async (req, res) => {
    const data = await gtfs.getStopsForRoute(req.params.routeId);
    res.json({ success: true, data });
  })
);

// Trips for a route
router.get(
  '/:routeId/trips',
  asyncHandler(async (req, res) => {
    const data = await gtfs.getTripsForRoute(req.params.routeId);
    res.json({ success: true, data });
  })
);

// Real-time vehicle positions
router.get(
  '/:routeId/vehicles',
  asyncHandler(async (req, res) => {
    const data = await gtfs.getVehiclePositions(req.params.routeId);
    res.json({ success: true, data });
  })
);

// Real-time trip updates
router.get(
  '/:routeId/trip-updates',
  asyncHandler(async (req, res) => {
    const data = await gtfs.getTripUpdates(req.params.routeId);
    res.json({ success: true, data });
  })
);

export default router;
