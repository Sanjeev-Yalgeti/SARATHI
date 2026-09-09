/**
 * routes/maps.js
 * Map-related helper endpoints.
 *
 * GET  /api/maps/static?lat=&lng=&zoom=&size=   — Google Static Maps image URL (proxied)
 * GET  /api/maps/agencies                        — list all GTFS agencies (transit operators)
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as gtfs from '../services/gtfs.service.js';

const router = Router();

// ── Static map URL helper ─────────────────────────────────────────────────
// Returns a signed URL (keeps API key hidden) — or proxies the image buffer
router.get(
  '/static',
  asyncHandler(async (req, res) => {
    const { lat, lng, zoom = 14, size = '600x300', maptype = 'roadmap' } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

    const KEY = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&maptype=${maptype}&key=${KEY}`;

    // Proxy the image so the key stays on server
    const { default: axios } = await import('axios');
    const imgResp = await axios.get(url, { responseType: 'stream' });
    res.setHeader('Content-Type', imgResp.headers['content-type']);
    imgResp.data.pipe(res);
  })
);

// ── GTFS Agencies ─────────────────────────────────────────────────────────
router.get(
  '/agencies',
  asyncHandler(async (_req, res) => {
    const data = await gtfs.getAgencies();
    res.json({ success: true, data });
  })
);

export default router;
