/**
 * here.service.js — DISABLED.
 * HERE Maps was abandoned (requires card even for free tier).
 * Use Google (googleMaps.service.js) or OSRM (osrm.service.js) instead.
 * Stubs below keep old imports from crashing at load time.
 */
function disabled() {
  const err = new Error('HERE provider is disabled — use provider=osrm or provider=google');
  err.status = 410;
  throw err;
}

/** @deprecated HERE disabled */
export async function geocodeAddress() {
  disabled();
}

/** @deprecated HERE disabled */
export async function getRoute() {
  disabled();
}

/** @deprecated HERE disabled */
export async function getTransitRoute() {
  disabled();
}
