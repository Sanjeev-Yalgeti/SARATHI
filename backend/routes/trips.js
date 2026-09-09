/**
 * routes/trips.js
 * Trip planning — combines OSRM, Google Maps, and HERE for routing.
 *
 * GET  /api/trips/plan          — plan a trip (origin→destination, provider choice)
 * GET  /api/trips/transit       — public transit route (HERE transit router)
 * GET  /api/trips/matrix        — distance/duration matrix (OSRM table)
 * GET  /api/trips/snap          — snap a lat/lng to nearest road (OSRM nearest)
 * GET  /api/trips/:tripId/stop-times — stop times for a GTFS trip
 */
import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import * as osrm from "../services/osrm.service.js";
import * as google from "../services/googleMaps.service.js";
import * as here from "../services/here.service.js";
import * as gtfs from "../services/gtfs.service.js";

const router = Router();

// ── Plan a road trip ──────────────────────────────────────────────────────
// ?originLat=&originLng=&destLat=&destLng=&provider=osrm|google|here&mode=driving
router.get(
  "/plan",
  asyncHandler(async (req, res) => {
    const { originLat, originLng, destLat, destLng, provider = "osrm", mode = "driving" } =
      req.query;

    if (!originLat || !originLng || !destLat || !destLng) {
      return res
        .status(400)
        .json({ error: "originLat, originLng, destLat, destLng are required" });
    }

    const origin = { lat: parseFloat(originLat), lng: parseFloat(originLng) };
    const dest = { lat: parseFloat(destLat), lng: parseFloat(destLng) };

    let routes;
    if (provider === "google") {
      routes = await google.getDirections(origin, dest, mode);
    } else if (provider === "here") {
      routes = await here.getRoute(origin, dest, mode);
    } else {
      // Default: OSRM
      routes = await osrm.getRoute(origin.lng, origin.lat, dest.lng, dest.lat);
    }

    res.json({ success: true, provider, data: routes });
  })
);

// ── Public transit routing (HERE) ─────────────────────────────────────────
// ?originLat=&originLng=&destLat=&destLng=&departureTime=ISO8601
router.get(
  "/transit",
  asyncHandler(async (req, res) => {
    const { originLat, originLng, destLat, destLng, departureTime } = req.query;

    if (!originLat || !originLng || !destLat || !destLng) {
      return res
        .status(400)
        .json({ error: "originLat, originLng, destLat, destLng are required" });
    }

    const routes = await here.getTransitRoute(
      { lat: parseFloat(originLat), lng: parseFloat(originLng) },
      { lat: parseFloat(destLat), lng: parseFloat(destLng) },
      departureTime
    );

    res.json({ success: true, data: routes });
  })
);

// ── Distance matrix (OSRM) ────────────────────────────────────────────────
// POST body: { coordinates: [{lat, lng}, ...] }
router.post(
  "/matrix",
  asyncHandler(async (req, res) => {
    const { coordinates } = req.body;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return res
        .status(400)
        .json({ error: "coordinates array with at least 2 points is required" });
    }
    const data = await osrm.distanceMatrix(coordinates);
    res.json({ success: true, data });
  })
);

// ── Snap to road (OSRM nearest) ───────────────────────────────────────────
// ?lat=&lng=
router.get(
  "/snap",
  asyncHandler(async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: "lat and lng are required" });
    const data = await osrm.nearestRoad(parseFloat(lng), parseFloat(lat));
    res.json({ success: true, data });
  })
);

// ── GTFS stop times for a trip ────────────────────────────────────────────
router.get(
  "/:tripId/stop-times",
  asyncHandler(async (req, res) => {
    const data = await gtfs.getStopTimes(req.params.tripId);
    res.json({ success: true, data });
  })
);

export default router;
