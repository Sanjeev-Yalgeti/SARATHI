import { useEffect, useState, useRef, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import {
  Radio,
  AlertTriangle,
  Truck as TruckIcon,
  Layers,
  Calendar,
  ShieldAlert,
  Info,
  Flame,
} from "lucide-react";
import HeatmapLayer from "./HeatmapLayer";
import { useHeatData } from "../hooks/useHeatData";
import { isNetworkError } from "../api/auth";

// Severity color tokens
const SEVERITY_COLORS = {
  RED: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#2563eb",
  LOW: "#16a34a",
};

// Truck status color tokens
const TRUCK_COLORS = {
  moving: "#16a34a",
  blocked: "#dc2626",
  idle: "#64748b",
};

// Realistic fallback demo data for dev testing when backend is offline
const FALLBACK_INCIDENTS_PEAK = [
  {
    id: "KAM-01",
    lat: 26.1909,
    lng: 91.7653,
    type: "landslide",
    severity: "HIGH",
    eventDate: "2026-07-28",
    road: "Navagraha Hill Road, Guwahati",
    district: "Kamrup Metropolitan",
    note: "Guard wall collapsed onto road due to landslide (19-07-2026)",
  },
  {
    id: "ASDMA-01",
    lat: 26.5862,
    lng: 93.3081,
    type: "breach",
    severity: "RED",
    eventDate: "2026-07-28",
    road: "Kaziranga Basapathar Ali",
    district: "Golaghat",
    note: "Breach occurred at 2 KM mark on the road (20-07-2026)",
  },
  {
    id: "ASDMA-02",
    lat: 26.16753,
    lng: 92.5433,
    type: "overtop",
    severity: "HIGH",
    eventDate: "2026-07-28",
    road: "Kakatigaon to Hatigarh Road",
    district: "Nagaon",
    note: "Road damaged from 4.1 km to 4.5 km by floodwater (19-08-2026)",
  },
  {
    id: "ASDMA-04",
    lat: 26.4712,
    lng: 93.9421,
    type: "breach",
    severity: "RED",
    eventDate: "2026-07-28",
    road: "Barichuwa Gaon Culvert",
    district: "Golaghat",
    note: "Washed away 1 RCC slab culvert at Barichuwa (20-07-2026)",
  },
  {
    id: "ASDMA-05",
    lat: 26.7531,
    lng: 94.2045,
    type: "erosion",
    severity: "HIGH",
    eventDate: "2026-07-28",
    road: "Bhogdoi Rightbank Road to Chengeliati",
    district: "Jorhat",
    note: "Erosion damage length 75 meters at Mojia Bheti (20-07-2026)",
  },
];

const FALLBACK_VEHICLES_BASE = [
  {
    vehicleId: "AS-01-FOOD-04",
    lat: 26.54,
    lng: 93.35,
    speed: 0,
    status: "blocked",
    origin: "Guwahati",
    destination: "Golaghat relief camp",
    cargoType: "rice+medicines",
  },
  {
    vehicleId: "AS-02-MED-11",
    lat: 26.35,
    lng: 92.68,
    speed: 48,
    status: "moving",
    origin: "Guwahati",
    destination: "Sivasagar",
    cargoType: "medicines",
  },
  {
    vehicleId: "AS-03-FUEL-07",
    lat: 26.22,
    lng: 91.95,
    speed: 52,
    status: "moving",
    origin: "Guwahati",
    destination: "Sivasagar via Nagaon",
    cargoType: "fuel",
  },
];

export default function LiveMap({
  token,
  userRole = "ADMIN",
  currentUser = null,
  date = "2026-07-28",
  apiUrl,
  pollMs = 2000,
  showIncidents: initialShowIncidents = true,
  showBanner: initialShowBanner = true,
  showHeatmap: initialShowHeatmap = true,
  initialHeatMode = "all", // "incidents" | "all"
  theme = "light",
  height = "520px",
  onDateChange,
}) {
  const base =
    apiUrl ?? import.meta.env.VITE_API_URL ?? "http://localhost:5001";
  const jwt = token ?? localStorage.getItem("sarathi_token") ?? "";

  const [selectedDate, setSelectedDate] = useState(date);
  const [vehicles, setVehicles] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [showIncidents, setShowIncidents] = useState(initialShowIncidents);
  const [showVehicles, setShowVehicles] = useState(true);
  const [showBanner, setShowBanner] = useState(initialShowBanner);
  const [showHeatmap, setShowHeatmap] = useState(initialShowHeatmap);
  const [heatMode, setHeatMode] = useState(initialHeatMode);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Risk Heatmap data hook: fetches incidents + coarse risk grid over corridor bbox
  const heatData = useHeatData({
    date: selectedDate,
    token: jwt,
    apiUrl: base,
    mode: heatMode,
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const headers = useMemo(() => {
    return jwt ? { Authorization: `Bearer ${jwt}` } : {};
  }, [jwt]);

  // 1. Vehicle Polling (every 2s per FRONTEND_HANDOFF.md §5)
  useEffect(() => {
    let timer = null;

    async function fetchVehicles() {
      try {
        const res = await fetch(`${base}/api/vehicles`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (isMountedRef.current) {
            setVehicles(data.vehicles ?? []);
            setIsLiveConnected(true);
          }
          return;
        }
      } catch (err) {
        if (!isNetworkError(err)) {
          // Silent catch for poll retry
        }
      }

      // Offline dev bypass fallback
      if (isMountedRef.current) {
        setIsLiveConnected(false);
        setVehicles((prev) => {
          const list = prev.length > 0 ? prev : FALLBACK_VEHICLES_BASE;
          return list.map((v, i) => {
            if (v.status === "blocked") return v;
            const drift = Math.sin(Date.now() / 2000 + i) * 0.002;
            return {
              ...v,
              lat: v.lat + drift,
              lng: v.lng + (i === 1 ? 0.001 : 0.0015),
            };
          });
        });
      }
    }

    fetchVehicles();
    timer = setInterval(fetchVehicles, pollMs);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [base, headers, pollMs]);

  // 2. Incident & Route Analysis Fetching
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      // Fetch incidents
      try {
        const res = await fetch(`${base}/api/incidents?date=${selectedDate}`, {
          headers,
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setIncidents(data.incidents ?? []);
        } else if (!res.ok && !cancelled) {
          setIncidents(
            selectedDate === "2026-07-28" ? FALLBACK_INCIDENTS_PEAK : []
          );
        }
      } catch {
        if (!cancelled) {
          setIncidents(
            selectedDate === "2026-07-28" ? FALLBACK_INCIDENTS_PEAK : []
          );
        }
      }

      // Fetch route analysis for Guwahati -> Sivasagar corridor
      try {
        const res = await fetch(`${base}/api/route/analyze`, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            origin: { lat: 26.1844, lng: 91.7458 },
            destination: { lat: 27.14, lng: 94.63 },
            eventDate: selectedDate,
          }),
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setAnalysis(data);
        } else if (!cancelled) {
          setAnalysis(
            selectedDate === "2026-07-28"
              ? {
                  blocked: true,
                  delayMessage:
                    "Severe breach near Kaziranga (KM 2) & Barichuwa culvert washaway. Traffic halted on NH-715.",
                  recommendedRoad: "Divert north via Tezpur & NH-15 corridor",
                  level: "RED",
                }
              : null
          );
        }
      } catch {
        if (!cancelled) {
          setAnalysis(
            selectedDate === "2026-07-28"
              ? {
                  blocked: true,
                  delayMessage:
                    "Severe breach near Kaziranga (KM 2) & Barichuwa culvert washaway. Traffic halted on NH-715.",
                  recommendedRoad: "Divert north via Tezpur & NH-15 corridor",
                  level: "RED",
                }
              : null
          );
        }
      }
    }

    loadData();
    onDateChange?.(selectedDate);

    return () => {
      cancelled = true;
    };
  }, [base, headers, selectedDate, onDateChange]);

  // Role scoping: Driver only sees their assigned vehicle
  const isDriver = userRole === "DRIVER" || userRole === "restricted";
  const driverVehicleId = currentUser?.id;

  const displayVehicles = useMemo(() => {
    if (!showVehicles) return [];
    if (isDriver && driverVehicleId) {
      const filtered = vehicles.filter((v) => v.vehicleId === driverVehicleId);
      return filtered.length > 0 ? filtered : vehicles.slice(0, 1);
    }
    return vehicles;
  }, [vehicles, showVehicles, isDriver, driverVehicleId]);

  const displayIncidents = showIncidents ? incidents : [];
  const displayBanner = showBanner ? analysis : null;

  // Tile layer URL based on current theme
  const tileUrl =
    theme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <div className="flex flex-col gap-3 font-sans w-full">
      {/* Top Map Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-gray-200 dark:border-slate-800 shadow-sm">
        {/* Scenario Date Switcher */}
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <Calendar size={16} className="text-[#0a8754] shrink-0" />
          <span className="font-bold text-gray-700 dark:text-gray-300">
            Scenario Date:
          </span>
          <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg">
            {[
              { date: "2026-07-19", label: "19 Jul (Onset)" },
              { date: "2026-07-28", label: "28 Jul (Peak)" },
              { date: "2026-08-09", label: "09 Aug (Relief)" },
            ].map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelectedDate(d.date)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  selectedDate === d.date
                    ? "bg-[#0a8754] text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* View Layer Toggles & Live Status Indicator */}
        <div className="flex items-center gap-2.5 flex-wrap text-xs">
          {/* Incidents Toggle */}
          <button
            type="button"
            onClick={() => setShowIncidents(!showIncidents)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-colors ${
              showIncidents
                ? "bg-red-50 dark:bg-red-950/30 text-red-600 border-red-200 dark:border-red-900"
                : "bg-gray-100 dark:bg-slate-800 text-gray-500 border-transparent"
            }`}
          >
            <AlertTriangle size={13} />
            <span>Incidents ({displayIncidents.length})</span>
          </button>

          {/* Trucks Toggle */}
          <button
            type="button"
            onClick={() => setShowVehicles(!showVehicles)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-colors ${
              showVehicles
                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 border-emerald-200 dark:border-emerald-900"
                : "bg-gray-100 dark:bg-slate-800 text-gray-500 border-transparent"
            }`}
          >
            <TruckIcon size={13} />
            <span>Fleet ({displayVehicles.length})</span>
          </button>

          {/* Banner Toggle */}
          <button
            type="button"
            onClick={() => setShowBanner(!showBanner)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-colors ${
              showBanner
                ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 border-amber-200 dark:border-amber-900"
                : "bg-gray-100 dark:bg-slate-800 text-gray-500 border-transparent"
            }`}
          >
            <Layers size={13} />
            <span>Risk Banner</span>
          </button>

          {/* Heatmap Layer Toggle */}
          <button
            type="button"
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-colors ${
              showHeatmap
                ? "bg-orange-50 dark:bg-orange-950/30 text-orange-600 border-orange-200 dark:border-orange-900 shadow-xs"
                : "bg-gray-100 dark:bg-slate-800 text-gray-500 border-transparent"
            }`}
            title="Toggle risk heatmap overlay"
          >
            <Flame
              size={13}
              className={showHeatmap ? "text-orange-500 fill-orange-500" : ""}
            />
            <span>Heatmap ({heatData.points.length})</span>
          </button>

          {/* Heatmap Mode Selector (Incidents Only vs Incidents + Risk Grid) */}
          {showHeatmap && (
            <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg border border-gray-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setHeatMode("incidents")}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                  heatMode === "incidents"
                    ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
                title="Heatmap from confirmed incidents only"
              >
                Incidents Only
              </button>
              <button
                type="button"
                onClick={() => setHeatMode("all")}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer flex items-center gap-1 ${
                  heatMode === "all"
                    ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
                title="Heatmap from confirmed incidents + sampled corridor risk grid (35 cells)"
              >
                <span>Incidents + Risk Grid</span>
                {heatData.isGridLoading && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                )}
              </button>
            </div>
          )}

          {/* Live Polling Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
              isLiveConnected
                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
            }`}
          >
            <Radio
              size={12}
              className={isLiveConnected ? "animate-pulse text-green-600" : ""}
            />
            <span>{isLiveConnected ? "LIVE (2s)" : "SIMULATED (2s)"}</span>
          </div>
        </div>
      </div>

      {/* Corridor Risk Alert Banner (POST /api/route/analyze) */}
      {displayBanner?.blocked && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-900 shadow-sm animate-fadeIn">
          <div className="p-1.5 rounded-lg bg-red-600 text-white shrink-0 mt-0.5">
            <ShieldAlert size={18} />
          </div>
          <div className="flex-1 text-sm">
            <div className="font-extrabold flex items-center gap-2">
              <span>RED RISK ALERT — CORRIDOR IMPASSABLE</span>
              <span className="text-xs px-2 py-0.2 rounded-full bg-red-600 text-white font-mono uppercase">
                {displayBanner.level || "RED"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-red-800 leading-relaxed">
              {displayBanner.delayMessage}
            </p>
            {displayBanner.recommendedRoad && (
              <p className="mt-1 text-xs font-semibold text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-md inline-block">
                🧭 Recommendation: {displayBanner.recommendedRoad}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Leaflet Map Frame */}
      <div
        style={{ height, minHeight: 440 }}
        className="relative w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-800 shadow-lg z-0"
      >
        <MapContainer
          center={[26.45, 93.1]}
          zoom={8}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url={tileUrl}
          />

          {/* Risk Heatmap Layer (underneath markers) */}
          {showHeatmap && (
            <HeatmapLayer
              points={heatData.points}
              radius={25}
              blur={20}
              minOpacity={0.4}
              gradient={{
                0.2: "#16a34a", // LOW (green)
                0.4: "#eab308", // MEDIUM (yellow)
                0.7: "#ea580c", // HIGH (orange)
                1.0: "#dc2626", // RED (red)
              }}
              max={1.0}
            />
          )}

          {/* Vehicle Markers */}
          {displayVehicles.map((v) => {
            const isBlocked = v.status === "blocked";
            const color = TRUCK_COLORS[v.status] ?? "#64748b";

            return (
              <CircleMarker
                key={v.vehicleId}
                center={[v.lat, v.lng]}
                radius={isBlocked ? 10 : 8}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.9,
                  weight: 2.5,
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                  <span className="font-bold">{v.vehicleId}</span> &bull;{" "}
                  <span className="capitalize">{v.status}</span>
                </Tooltip>
                <Popup>
                  <div className="text-xs p-1">
                    <div className="flex items-center justify-between gap-2 border-b pb-1 mb-1.5 font-bold">
                      <span className="text-sm font-extrabold text-gray-900">
                        {v.vehicleId}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-white"
                        style={{ background: color }}
                      >
                        {v.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-gray-700">
                      <div>
                        <b>Cargo:</b> {v.cargoType}
                      </div>
                      <div>
                        <b>Route:</b> {v.origin} &rarr; {v.destination}
                      </div>
                      <div>
                        <b>Speed:</b> {v.speed} km/h
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        GPS: {v.lat.toFixed(4)}, {v.lng.toFixed(4)}
                      </div>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* Incident Markers */}
          {displayIncidents.map((inc) => {
            const color = SEVERITY_COLORS[inc.severity] ?? "#dc2626";

            return (
              <CircleMarker
                key={inc.id}
                center={[inc.lat, inc.lng]}
                radius={inc.severity === "RED" ? 8 : 6}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.85,
                  weight: 2,
                }}
              >
                <Tooltip direction="bottom" offset={[0, 8]} opacity={0.95}>
                  <b>[{inc.severity}]</b> {inc.type} &bull; {inc.road}
                </Tooltip>
                <Popup>
                  <div className="text-xs p-1 max-w-[240px]">
                    <div className="flex items-center justify-between border-b pb-1 mb-1.5">
                      <span className="font-bold text-gray-900 capitalize">
                        {inc.type} Incident
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] uppercase font-extrabold text-white"
                        style={{ background: color }}
                      >
                        {inc.severity}
                      </span>
                    </div>
                    <div className="space-y-1 text-gray-700">
                      <div>
                        <b>Road:</b> {inc.road || "Not recorded"}
                      </div>
                      <div>
                        <b>District:</b> {inc.district || "NER"}
                      </div>
                      <div>
                        <b>Date:</b> {inc.eventDate}
                      </div>
                      {inc.note && (
                        <div className="mt-1.5 p-1.5 bg-gray-50 rounded border text-[11px] italic text-gray-600">
                          {inc.note}
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Floating Map Legend Overlay */}
        <div className="absolute bottom-4 right-4 z-[400] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-gray-200 dark:border-slate-800 shadow-md text-xs pointer-events-auto max-w-[280px]">
          <div className="font-bold mb-2 flex items-center justify-between gap-1 text-gray-800 dark:text-gray-200">
            <div className="flex items-center gap-1">
              <Info size={13} />
              <span>Map Legend</span>
            </div>
            {showHeatmap && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 font-semibold">
                Heat Active
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a]" />
              <span>Moving Truck</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" />
              <span>Blocked Truck</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" />
              <span>RED Incident</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ea580c]" />
              <span>HIGH Risk</span>
            </div>
          </div>

          {/* Heatmap Risk Gradient Chips & Transparency Info Line */}
          {showHeatmap && (
            <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-slate-800">
              <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center justify-between">
                <span>HEATMAP RISK LEVEL</span>
                <span className="font-mono text-[9px] text-gray-400">0.0 &rarr; 1.0</span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center text-[9px] font-bold">
                <span className="px-1 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  LOW
                </span>
                <span className="px-1 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-800">
                  MED
                </span>
                <span className="px-1 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-300 dark:border-orange-800">
                  HIGH
                </span>
                <span className="px-1 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-300 dark:border-red-800">
                  RED
                </span>
              </div>

              {/* Transparency / Model Source Line */}
              <div className="mt-2 pt-1.5 border-t border-dashed border-gray-200 dark:border-slate-800 text-[10px] text-gray-500 dark:text-gray-400 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Model Source:</span>
                  <span
                    className={`font-semibold uppercase text-[9px] px-1.5 py-0.2 rounded ${
                      heatData.metadata.source === "ml"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-bold"
                        : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300 font-mono"
                    }`}
                  >
                    {heatData.metadata.source === "ml" ? "Disaster-ML" : "Heuristic"}
                  </span>
                </div>
                {heatData.metadata.baseDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Base Date:</span>
                    <span className="font-mono text-[9px] text-gray-700 dark:text-gray-300">
                      {heatData.metadata.baseDate}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[9px] text-gray-400">
                  <span>Coverage:</span>
                  <span>
                    {heatData.points.length} pts ({heatMode === "incidents" ? "Incidents" : "Incidents + Grid"})
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
