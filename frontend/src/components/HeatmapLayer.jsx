import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat/dist/leaflet-heat.js";

/**
 * HeatmapLayer
 * Thin React wrapper around Leaflet.heat (L.heatLayer).
 * Renders under existing markers and cleans up completely on unmount or prop changes.
 *
 * @param {Array<[number, number, number]>} points - Array of [lat, lng, intensity (0-1)]
 * @param {number} radius - Heat radius in pixels (default 25)
 * @param {number} blur - Heat blur in pixels (default 20)
 * @param {number} minOpacity - Minimum opacity (default 0.4)
 * @param {Object} gradient - Heat color gradient mapping (green -> yellow -> orange -> red)
 * @param {number} max - Maximum intensity value (default 1.0)
 */
const DEFAULT_GRADIENT = {
  0.2: "#16a34a", // LOW (green)
  0.4: "#eab308", // MEDIUM (yellow)
  0.7: "#ea580c", // HIGH (orange)
  1.0: "#dc2626", // RED (red)
};

export default function HeatmapLayer({
  points = [],
  radius = 25,
  blur = 20,
  minOpacity = 0.4,
  gradient = DEFAULT_GRADIENT,
  max = 1.0,
}) {
  const map = useMap();
  const layerRef = useRef(null);
  // Stabilize inline gradient objects (e.g. from LiveMap.jsx) so the
  // effect doesn't recreate the heat layer on every render.
  const gradientKey = JSON.stringify(gradient);

  useEffect(() => {
    if (!map) return;

    // Safety check if leaflet.heat is attached
    if (!L.heatLayer) {
      console.warn("[HeatmapLayer] L.heatLayer plugin not loaded on Leaflet.");
      return;
    }

    // Clean up previous instance before creating a new one
    if (layerRef.current) {
      try {
        map.removeLayer(layerRef.current);
      } catch {
        // Safe catch if already detached
      }
      layerRef.current = null;
    }

    // If points is empty, don't mount an active heat canvas
    if (!points || points.length === 0) {
      return;
    }

    // Filter valid coordinate tuples
    const validPoints = points
      .filter(
        (p) =>
          Array.isArray(p) &&
          p.length >= 2 &&
          Number.isFinite(p[0]) &&
          Number.isFinite(p[1])
      )
      .map((p) => [
        Number(p[0]),
        Number(p[1]),
        Math.max(0, Math.min(1, Number(p[2] ?? 0.5))),
      ]);

    if (validPoints.length === 0) return;

    const heatLayer = L.heatLayer(validPoints, {
      radius,
      blur,
      minOpacity,
      max,
      gradient,
    });

    heatLayer.addTo(map);
    layerRef.current = heatLayer;

    return () => {
      if (layerRef.current && map) {
        try {
          map.removeLayer(layerRef.current);
        } catch {
          // Safe catch
        }
        layerRef.current = null;
      }
    };
  // gradientKey stabilizes inline gradient objects to avoid layer recreation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points, radius, blur, minOpacity, gradientKey, max]);

  return null;
}
