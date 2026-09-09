/**
 * here.service.js
 * Wrapper around HERE Maps REST APIs.
 * Docs: https://developer.here.com/documentation
 */
import axios from 'axios';

const HERE_KEY = process.env.HERE_API_KEY;

const hereGeocode = axios.create({
  baseURL: 'https://geocode.search.hereapi.com/v1',
  timeout: 10_000,
});

const hereRouting = axios.create({
  baseURL: 'https://router.hereapi.com/v8',
  timeout: 15_000,
});

const hereTransit = axios.create({
  baseURL: 'https://transit.router.hereapi.com/v8',
  timeout: 15_000,
});

/** Geocode an address using HERE */
export async function geocodeAddress(address) {
  const { data } = await hereGeocode.get('/geocode', {
    params: { q: address, apiKey: HERE_KEY },
  });
  if (!data.items?.length) {
    const err = new Error('HERE geocode: no results');
    err.status = 404;
    throw err;
  }
  const item = data.items[0];
  return {
    lat: item.position.lat,
    lng: item.position.lng,
    formattedAddress: item.address.label,
    placeId: item.id,
  };
}

/** Get a driving/transit route using HERE Routing v8 */
export async function getRoute(origin, destination, transportMode = 'car') {
  const { data } = await hereRouting.get('/routes', {
    params: {
      transportMode,
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      return: 'summary,polyline,actions,instructions',
      apiKey: HERE_KEY,
    },
  });
  return data.routes;
}

/** Public transit route planning */
export async function getTransitRoute(origin, destination, departureTime) {
  const { data } = await hereTransit.get('/routes', {
    params: {
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      departureTime: departureTime || new Date().toISOString(),
      return: 'intermediate,travelSummary',
      apiKey: HERE_KEY,
    },
  });
  return data.routes;
}
