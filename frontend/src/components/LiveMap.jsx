import { useEffect, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
} from "react-leaflet";

/**
 * LiveMap — drop-in Leaflet map for the SARATHI Figma frontend.
 * Backend focus stays intact: this is the ONLY frontend piece.
 *
 * Data sources (all real backend, no fake incidents):
 * - GET /api/vehicles ................ live truck GPS (simulated movement,
 *                                       real RED incidents stop trucks)
 * - GET /api/incidents?date=YYYY-MM-DD  real bulletin incidents for the date
 * - POST /api/route/analyze ........... corridor risk banner (optional)
 * - POST /api/simulation/date ......... scenario clock (admin token only)
 *
 * Usage:
 *   import LiveMap from "./components/LiveMap";
 *   <LiveMap token={jwt} date="2026-07-28" />
 *
 * Props:
 *   token .......... JWT (falls back to localStorage "sarathi_token")
 *   date ........... scenario date YYYY-MM-DD (default "2026-07-28")
 *   apiUrl ......... backend base (default VITE_API_URL or localhost:5001)
 *   pollMs ......... vehicle refresh interval (default 2000)
 *   showIncidents .. render incident pins (default true)
 *   showBanner ..... render RED risk banner via /api/route/analyze (default true)
 *   origin/dest .... corridor analysed for the banner
 *   height ......... CSS height of the map (default "52vh")
 *   onDateChange ... (date) => void, hook for your own date switcher
 */
const SEVERITY_COLOR = {
  RED: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#2563eb",
  LOW: "#16a34a",
};

const TRUCK_COLOR = { moving: "#2e7d32", blocked: "#dc2626", idle: "#6b7280" };

export default function LiveMap({
  token,
  date = "2026-07-28",
  apiUrl,
  pollMs = 2000,
  showIncidents = true,
  showBanner = true,
  origin = { lat: 26.1844, lng: 91.7458 },
  destination = { lat: 27.14, lng: 94.63 },
  height = "52vh",
  onDateChange,
}) {
  const base =
    apiUrl ?? import.meta.env.VITE_API_URL ?? "http://localhost:5001";
  const jwt = token ?? localStorage.getItem("sarathi_token") ?? "";

  const [vehicles, setVehicles] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [analysis, setAnalysis] = useState(null);

  const headers = { Authorization: `Bearer ${jwt}` };

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`${base}/api/vehicles`, { headers });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setVehicles(data.vehicles ?? []);
        }
      } catch {
        // Next tick retries.
      }
    }
    void poll();
    const t = setInterval(() => void poll(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, jwt, pollMs]);

  useEffect(() => {
    let cancelled = false;
    if (showIncidents) {
      fetch(`${base}/api/incidents?date=${date}`, { headers }).then(
        async (res) => {
          if (!cancelled && res.ok) {
            const data = await res.json();
            setIncidents(data.incidents ?? []);
          }
        },
        () => {},
      );
    }
    if (showBanner) {
      fetch(`${base}/api/route/analyze`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, eventDate: date }),
      }).then(
        async (res) => {
          if (!cancelled) setAnalysis(res.ok ? await res.json() : null);
        },
        () => {
          if (!cancelled) setAnalysis(null);
        },
      );
    }
    onDateChange?.(date);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, jwt, date, showIncidents, showBanner]);

  // Props act as display filters; cached data stays for instant toggling.
  const displayIncidents = showIncidents ? incidents : [];
  const displayBanner = showBanner ? analysis : null;

  return (
    <div>
      {displayBanner?.blocked && (
        <div
          className="rounded-lg px-4 py-2 mb-3 text-sm font-bold"
          style={{ background: "#fee2e2", color: "#991b1b" }}
        >
          RED alert: {displayBanner.delayMessage} Recommended:{" "}
          {displayBanner.recommendedRoad}
        </div>
      )}
      <div
        style={{ height, minHeight: 380 }}
        className="rounded-2xl overflow-hidden"
      >
        <MapContainer
          center={[26.6, 93.0]}
          zoom={7}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {vehicles.map((v) => (
            <CircleMarker
              key={v.vehicleId}
              center={[v.lat, v.lng]}
              radius={9}
              pathOptions={{
                color: TRUCK_COLOR[v.status] ?? "#6b7280",
                fillOpacity: 0.9,
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                {v.vehicleId} · {v.status}
              </Tooltip>
              <Popup>
                <b>{v.vehicleId}</b>
                <br />
                {v.cargoType} · {v.origin} → {v.destination}
                <br />
                {v.speed} km/h · {v.status.toUpperCase()}
              </Popup>
            </CircleMarker>
          ))}
          {displayIncidents.map((i) => (
            <CircleMarker
              key={i.id}
              center={[i.lat, i.lng]}
              radius={6}
              pathOptions={{
                color: SEVERITY_COLOR[i.severity] ?? "#6b7280",
                fillOpacity: 0.85,
              }}
            >
              <Popup>
                <b>
                  [{i.severity}] {i.road ?? i.type}
                </b>
                <br />
                {i.district ?? "district not recorded"} · {i.eventDate}
                {i.note && (
                  <>
                    <br />
                    {i.note}
                  </>
                )}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
