/**
 * routes/geocode.js
 * Geocoding endpoints — proxies Google Maps and HERE so API keys stay server-side.
 *
 * GET  /api/geocode?address=...                — forward geocode (address → lat/lng)
 * GET  /api/geocode/reverse?lat=...&lng=...    — reverse geocode (lat/lng → address)
 * GET  /api/geocode/autocomplete?input=...     — Google Places autocomplete
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as google from '../../services/googleMaps.service.js';
import * as here from '../../services/here.service.js';

const router = Router();

// ── Forward Geocode ────────────────────────────────────────────────────────
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { address, provider = 'google' } = req.query;
    if (!address) return res.status(400).json({ error: 'address is required' });

    const result =
      provider === 'here'
        ? await here.geocodeAddress(address)
        : await google.geocodeAddress(address);

    res.json({ success: true, data: result });
  })
);

// ── Reverse Geocode ────────────────────────────────────────────────────────
router.get(
  '/reverse',
  asyncHandler(async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

    const result = await google.reverseGeocode(parseFloat(lat), parseFloat(lng));
    res.json({ success: true, data: result });
  })
);

// ── Places Autocomplete ────────────────────────────────────────────────────
router.get(
  '/autocomplete',
  asyncHandler(async (req, res) => {
    const { input, sessiontoken } = req.query;
    if (!input) return res.status(400).json({ error: 'input is required' });

    const predictions = await google.placesAutocomplete(input, sessiontoken);
    res.json({ success: true, data: predictions });
  })
);

export default router;
