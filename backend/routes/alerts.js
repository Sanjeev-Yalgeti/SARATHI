/**
 * routes/alerts.js
 * Service alerts and disruptions from GTFS real-time feed.
 *
 * GET  /api/alerts              — all active service alerts
 * GET  /api/alerts/:routeId     — alerts for a specific route
 */
import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import * as gtfs from "../services/gtfs.service.js";

const router = Router();

// All service alerts
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const data = await gtfs.getServiceAlerts();
    res.json({ success: true, data });
  })
);

// Alerts for a specific route
router.get(
  "/:routeId",
  asyncHandler(async (req, res) => {
    // GTFS real-time alerts are global; filter client-side or extend gtfs.service
    const all = await gtfs.getServiceAlerts();
    const filtered = Array.isArray(all)
      ? all.filter((alert) =>
          alert.informed_entity?.some(
            (e) => e.route_id === req.params.routeId
          )
        )
      : all;
    res.json({ success: true, data: filtered });
  })
);

export default router;
