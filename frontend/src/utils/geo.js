/**
 * Calculate Haversine distance between two coordinates in kilometers
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return 0;
  }

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if user is within the required 1 km radius of the incident
 */
export function isWithin1KmRadius(userLat, userLng, incidentLat, incidentLng) {
  const dist = haversineDistanceKm(userLat, userLng, incidentLat, incidentLng);
  return dist <= 1.0;
}

/**
 * Format distance into human readable string
 */
export function formatDistance(distKm) {
  if (!Number.isFinite(distKm)) return "Unknown";
  if (distKm < 1.0) {
    return `${Math.round(distKm * 1000)} meters`;
  }
  return `${distKm.toFixed(2)} km`;
}
