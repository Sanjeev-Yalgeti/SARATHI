/**
 * googleMaps.service.js
 * Thin wrapper around Google Maps Platform endpoints.
 * All calls go through a single axios instance so we never
 * ship the API key to the frontend.
 */
import axios from "axios";

const BASE = "https://maps.googleapis.com/maps/api";
const KEY = process.env.GOOGLE_MAPS_API_KEY;

const gmaps = axios.create({ baseURL: BASE, timeout: 10_000 });

/** Geocode a free-text address → { lat, lng, formattedAddress } */
export async function geocodeAddress(address) {
  const { data } = await gmaps.get("/geocode/json", {
    params: { address, key: KEY },
  });
  if (data.status !== "OK") {
    const err = new Error(`Google Geocode error: ${data.status}`);
    err.status = 502;
    throw err;
  }
  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
    placeId: result.place_id,
  };
}

/** Reverse-geocode { lat, lng } → { formattedAddress, placeId } */
export async function reverseGeocode(lat, lng) {
  const { data } = await gmaps.get("/geocode/json", {
    params: { latlng: `${lat},${lng}`, key: KEY },
  });
  if (data.status !== "OK") {
    const err = new Error(`Google Reverse Geocode error: ${data.status}`);
    err.status = 502;
    throw err;
  }
  const result = data.results[0];
  return {
    formattedAddress: result.formatted_address,
    placeId: result.place_id,
  };
}

/** Directions between two lat/lng points */
export async function getDirections(origin, destination, mode = "driving") {
  const { data } = await gmaps.get("/directions/json", {
    params: {
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      mode,
      key: KEY,
    },
  });
  if (data.status !== "OK") {
    const err = new Error(`Google Directions error: ${data.status}`);
    err.status = 502;
    throw err;
  }
  return data.routes;
}

/** Places autocomplete for search boxes */
export async function placesAutocomplete(input, sessiontoken) {
  const { data } = await gmaps.get("/place/autocomplete/json", {
    params: { input, sessiontoken, key: KEY },
  });
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    const err = new Error(`Google Places error: ${data.status}`);
    err.status = 502;
    throw err;
  }
  return data.predictions;
}
