import { useState, useEffect, useRef, useMemo } from "react";
import {
  Play,
  RotateCcw,
  RefreshCw,
  Truck,
  Waves,
  Calendar,
  Radio,
  Sliders,
  Send,
  ShieldAlert,
  Zap,
  MapPin,
  ChevronRight,
  Layers,
} from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, Circle } from "react-leaflet";
import apiClient from "../api/client";

// Scenario Dates matching SARATHI golden path
const SCENARIO_PRESETS = [
  {
    date: "2026-07-19",
    name: "Onset Stage",
    description: "Initial monsoon rain, all corridors clear, normal 40 km/h cruising.",
    color: "#16a34a",
    badge: "PASSABLE",
  },
  {
    date: "2026-07-28",
    name: "Peak Flood Crisis",
    description: "8 real breach & landslide incidents. Trucks within 15km of Kaziranga halt.",
    color: "#dc2626",
    badge: "CRITICAL RED",
  },
  {
    date: "2026-08-09",
    name: "Relief Recovery",
    description: "Post-peak mitigation, emergency supply corridors reopen via northern bypass.",
    color: "#2563eb",
    badge: "RECOVERY",
  },
];

// Presets for Mock GPS Ingest testing
const GPS_PRESETS = [
  {
    label: "Drop AS-01 in Kaziranga Danger Zone",
    vehicleId: "AS-01-FOOD-04",
    lat: 26.5862,
    lng: 93.3081,
    desc: "Within 15km breach zone -> triggers hard block",
  },
  {
    label: "Teleport AS-01 to Guwahati Safe Hub",
    vehicleId: "AS-01-FOOD-04",
    lat: 26.1844,
    lng: 91.7458,
    desc: "Origin supply terminal (safe staging zone)",
  },
  {
    label: "Reroute AS-02 to Tezpur Bypass",
    vehicleId: "AS-02-MED-11",
    lat: 26.634,
    lng: 92.798,
    desc: "Northern alternate corridor (NH-15)",
  },
];

export default function SimulationPage({ c, userRole = "ADMIN", currentUser = null, setActive }) {
  const [scenarioDate, setScenarioDate] = useState("2026-07-28");
  const [vehicles, setVehicles] = useState([]);
  const [mlRisk, setMlRisk] = useState({});
  const [scenarioOverrides, setScenarioOverrides] = useState({});
  const [incidents, setIncidents] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [tickCount, setTickCount] = useState(0);

  // What-If Knobs state
  const [rainfallOverride, setRainfallOverride] = useState(120);
  const [riverDangerOverride, setRiverDangerOverride] = useState(2);
  const [toastMessage, setToastMessage] = useState(null);

  // Mock GPS custom inputs
  const [customVehicleId, setCustomVehicleId] = useState("AS-01-FOOD-04");
  const [customLat, setCustomLat] = useState("26.5862");
  const [customLng, setCustomLng] = useState("93.3081");

  const isAdmin = userRole === "ADMIN";
  const isMountedRef = useRef(true);

  // Toast helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      if (isMountedRef.current) setToastMessage(null);
    }, 4000);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Poll simulation status every 2s (matches backend 2s tick)
  useEffect(() => {
    let cancelled = false;

    const fetchSimulationStatus = async () => {
      try {
        const res = await apiClient.get("/api/simulation/status");
        if (cancelled) return;

        if (res.data) {
          setScenarioDate(res.data.scenarioDate || "2026-07-28");
          setScenarioOverrides(res.data.scenarioOverrides || {});
          setMlRisk(res.data.mlRisk || {});
          setVehicles(res.data.vehicles || []);
          setTickCount((prev) => prev + 1);
        }
      } catch (err) {
        console.error("[SimulationPage] Failed to fetch simulation status:", err);
      }
    };

    void fetchSimulationStatus();
    const interval = setInterval(fetchSimulationStatus, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Fetch real incidents whenever scenario date changes
  useEffect(() => {
    let cancelled = false;

    const fetchIncidents = async () => {
      try {
        const res = await apiClient.get(`/api/incidents?date=${scenarioDate}`);
        if (!cancelled && res.data?.incidents) {
          setIncidents(res.data.incidents);
        }
      } catch (err) {
        console.error("[SimulationPage] Failed to fetch incidents:", err);
      }
    };

    void fetchIncidents();

    return () => {
      cancelled = true;
    };
  }, [scenarioDate]);

  // Switch Scenario Date (POST /api/simulation/date)
  const handleSwitchDate = async (newDate) => {
    setActionLoading(true);
    try {
      const res = await apiClient.post("/api/simulation/date", { date: newDate });
      setScenarioDate(res.data.scenarioDate);
      setVehicles(res.data.vehicles || []);
      showToast(`Switched scenario clock to ${newDate}. Simulation loop reset & unblocked.`);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to switch simulation scenario date.");
    } finally {
      setActionLoading(false);
    }
  };

  // Apply What-If scenario (POST /api/simulation/scenario)
  const handleApplyWhatIf = async () => {
    setActionLoading(true);
    try {
      const res = await apiClient.post("/api/simulation/scenario", {
        date: scenarioDate,
        rainfall_mm: Number(rainfallOverride),
        river_danger_level_count: Number(riverDangerOverride),
      });
      setScenarioOverrides(res.data.scenarioOverrides || {});
      setMlRisk(res.data.mlRisk || {});
      setVehicles(res.data.vehicles || []);
      showToast(
        `What-If applied! Rainfall: ${rainfallOverride}mm, Rivers > Danger: ${riverDangerOverride}. Re-evaluating truck motion.`
      );
    } catch (err) {
      alert(err.response?.data?.error || "Failed to apply What-If scenario.");
    } finally {
      setActionLoading(false);
    }
  };

  // Reset What-If scenario to defaults
  const handleResetWhatIf = async () => {
    setActionLoading(true);
    try {
      const res = await apiClient.post("/api/simulation/scenario", {
        date: scenarioDate,
      });
      setScenarioOverrides({});
      setRainfallOverride(0);
      setRiverDangerOverride(0);
      setVehicles(res.data.vehicles || []);
      showToast("What-If overrides cleared. Restored standard historical meteorological baseline.");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to reset scenario overrides.");
    } finally {
      setActionLoading(false);
    }
  };

  // Mock GPS Injection (POST /api/simulation/location)
  const handleInjectGps = async (vId, lat, lng) => {
    setActionLoading(true);
    try {
      await apiClient.post("/api/simulation/location", {
        vehicleId: vId,
        lat: Number(lat),
        lng: Number(lng),
      });
      showToast(`Mock GPS Ingest: ${vId} relocated to (${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}).`);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to inject mock GPS position.");
    } finally {
      setActionLoading(false);
    }
  };

  // Computed metrics
  const totalFleet = vehicles.length;
  const blockedCount = vehicles.filter((v) => v.status === "blocked").length;
  const movingCount = vehicles.filter((v) => v.status === "moving" || v.status === "slow").length;
  const avgSpeed =
    vehicles.length > 0
      ? Math.round(vehicles.reduce((sum, v) => sum + (v.speed || 0), 0) / vehicles.length)
      : 0;

  // Filter trucks if driver
  const displayedVehicles = useMemo(() => {
    if (!isAdmin && currentUser?.id) {
      const own = vehicles.filter((v) => v.vehicleId === currentUser.id);
      return own.length > 0 ? own : vehicles;
    }
    return vehicles;
  }, [vehicles, isAdmin, currentUser]);

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 animate-fade-in text-sm backdrop-blur-md">
          <Zap size={16} className="text-amber-400 shrink-0 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header with Live Engine Heartbeat */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-extrabold" style={{ color: c.text }}>
              Simulation Engine Lab
            </h1>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5"
              style={{
                background: "#0a87541a",
                color: "#0a8754",
                border: "1px solid #0a875440",
              }}
            >
              <Radio size={12} className="animate-pulse text-emerald-500" />
              <span>2.0s Real-time Tick Loop</span>
            </span>
          </div>
          <p className="text-sm sm:text-base" style={{ color: c.textMuted }}>
            {isAdmin
              ? "Replay flood scenarios, stress-test with What-If ML weather knobs, and observe dynamic truck motion rules."
              : `Live simulation telemetry for vehicle ${currentUser?.id || "assigned unit"}.`}
          </p>
        </div>

        {/* Quick Nav to Live Map */}
        {setActive && (
          <button
            onClick={() => setActive("Live Map")}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-all shadow-sm"
            style={{
              background: c.cardBg,
              borderColor: c.cardBorder,
              color: c.text,
            }}
          >
            <span>Inspect on Live Map</span>
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* ── 1. Scenario Date Switcher Bar (Admin / Presenter) ─────────── */}
      <div
        className="rounded-2xl p-5 border shadow-sm space-y-3"
        style={{ background: c.cardBg, borderColor: c.cardBorder }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-emerald-500" />
            <span className="text-sm font-bold tracking-wide" style={{ color: c.text }}>
              SCENARIO CLOCK CONTROLLER
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono" style={{ color: c.textMuted }}>
            <span>Active Clock:</span>
            <span className="font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {scenarioDate}
            </span>
            <span className="opacity-60">• Tick #{tickCount}</span>
            <button
              type="button"
              disabled={actionLoading || !isAdmin}
              onClick={() => handleSwitchDate(scenarioDate)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer disabled:opacity-40"
              style={{
                background: isAdmin ? "#0a8754" : c.cardBorder,
                color: "#fff",
                borderColor: "transparent",
              }}
              title="Re-post the current date: unblocks RED-stopped trucks and replays the loop from current positions"
            >
              <RefreshCw size={12} className={actionLoading ? "animate-spin" : ""} />
              Reload Simulation
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {SCENARIO_PRESETS.map((preset) => {
            const isSelected = scenarioDate === preset.date;
            return (
              <button
                key={preset.date}
                type="button"
                disabled={actionLoading || !isAdmin}
                onClick={() => handleSwitchDate(preset.date)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? "ring-2 ring-emerald-500 shadow-md"
                    : "hover:border-gray-400 dark:hover:border-gray-600 opacity-80 hover:opacity-100"
                }`}
                style={{
                  background: isSelected ? (preset.color + "12") : "transparent",
                  borderColor: isSelected ? preset.color : c.cardBorder,
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-extrabold text-sm" style={{ color: c.text }}>
                    {preset.name}
                  </span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: preset.color + "20",
                      color: preset.color,
                      border: `1px solid ${preset.color}40`,
                    }}
                  >
                    {preset.badge}
                  </span>
                </div>
                <div className="text-xs font-mono font-bold mb-1" style={{ color: preset.color }}>
                  {preset.date}
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: c.textMuted }}>
                  {preset.description}
                </p>
                {isSelected && (
                  <div
                    className="absolute top-2 right-2 w-2 h-2 rounded-full animate-ping"
                    style={{ background: preset.color }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. Live Telemetry KPI Cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fleet Size */}
        <div
          className="rounded-2xl p-4 border flex items-center gap-3.5 shadow-sm"
          style={{ background: c.cardBg, borderColor: c.cardBorder }}
        >
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <Truck size={22} />
          </div>
          <div>
            <div className="text-xs font-semibold" style={{ color: c.textMuted }}>
              Active Relief Fleet
            </div>
            <div className="text-2xl font-black" style={{ color: c.text }}>
              {totalFleet} <span className="text-xs font-normal text-gray-400">Trucks</span>
            </div>
          </div>
        </div>

        {/* Moving Trucks */}
        <div
          className="rounded-2xl p-4 border flex items-center gap-3.5 shadow-sm"
          style={{ background: c.cardBg, borderColor: c.cardBorder }}
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Play size={22} />
          </div>
          <div>
            <div className="text-xs font-semibold" style={{ color: c.textMuted }}>
              Moving Units
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {movingCount}{" "}
              <span className="text-xs font-normal text-gray-400">({avgSpeed} km/h avg)</span>
            </div>
          </div>
        </div>

        {/* Blocked Trucks */}
        <div
          className="rounded-2xl p-4 border flex items-center gap-3.5 shadow-sm"
          style={{ background: c.cardBg, borderColor: c.cardBorder }}
        >
          <div className="w-11 h-11 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
            <ShieldAlert size={22} />
          </div>
          <div>
            <div className="text-xs font-semibold" style={{ color: c.textMuted }}>
              Blocked Units (15km Threat)
            </div>
            <div className="text-2xl font-black text-red-600 dark:text-red-400">
              {blockedCount}{" "}
              <span className="text-xs font-normal text-gray-400">
                {blockedCount > 0 ? "Halted near breach" : "All clear"}
              </span>
            </div>
          </div>
        </div>

        {/* Real Incidents Active */}
        <div
          className="rounded-2xl p-4 border flex items-center gap-3.5 shadow-sm"
          style={{ background: c.cardBg, borderColor: c.cardBorder }}
        >
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Waves size={22} />
          </div>
          <div>
            <div className="text-xs font-semibold" style={{ color: c.textMuted }}>
              Verified Incidents
            </div>
            <div className="text-2xl font-black" style={{ color: c.text }}>
              {incidents.length}{" "}
              <span className="text-xs font-normal text-gray-400">on {scenarioDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Main Stage: Interactive Map & What-If Controls ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Real Leaflet Simulation Map */}
        <div
          className="lg:col-span-2 rounded-2xl border overflow-hidden shadow-sm flex flex-col"
          style={{ background: c.cardBg, borderColor: c.cardBorder }}
        >
          {/* Map Header */}
          <div
            className="px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2 text-xs font-semibold"
            style={{ borderColor: c.cardBorder }}
          >
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-emerald-500" />
              <span style={{ color: c.text }}>Assam Supply Corridor Live Geo-Grid</span>
            </div>
            <div className="flex items-center gap-4 text-[11px]" style={{ color: c.textMuted }}>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Moving Truck
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" /> Blocked Truck
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/40 border border-red-500 inline-block" /> 15km Hazard Zone
              </span>
            </div>
          </div>

          {/* Map Container */}
          <div className="relative w-full h-[440px] z-0">
            <MapContainer
              center={[26.42, 92.9]}
              zoom={8}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Threat Radii for RED incidents (15 km) */}
              {incidents
                .filter((inc) => inc.severity === "RED" || inc.type === "breach")
                .map((inc) => (
                  <Circle
                    key={`threat-${inc.id}`}
                    center={[inc.lat, inc.lng]}
                    radius={15000} // 15 km simulation block radius
                    pathOptions={{
                      color: "#dc2626",
                      fillColor: "#dc2626",
                      fillOpacity: 0.12,
                      weight: 1.5,
                      dashArray: "4, 6",
                    }}
                  >
                    <Tooltip sticky>
                      <span className="text-xs font-bold text-red-600">
                        15 km Emergency Block Radius ({inc.road || "Breach Site"})
                      </span>
                    </Tooltip>
                  </Circle>
                ))}

              {/* Incident Pins */}
              {incidents.map((inc) => (
                <CircleMarker
                  key={`inc-${inc.id}`}
                  center={[inc.lat, inc.lng]}
                  radius={7}
                  pathOptions={{
                    fillColor: inc.severity === "RED" ? "#dc2626" : "#ea580c",
                    fillOpacity: 0.9,
                    color: "#ffffff",
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="text-xs space-y-1 p-1 max-w-[200px]">
                      <div className="font-extrabold text-red-600 uppercase tracking-wide">
                        {inc.type} Incident [{inc.severity}]
                      </div>
                      <div className="font-semibold text-gray-900">{inc.road}</div>
                      <p className="text-gray-600 text-[11px]">{inc.note}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* Simulated Trucks */}
              {displayedVehicles.map((truck) => {
                const isBlocked = truck.status === "blocked";
                const isArrived = truck.status === "idle";
                const markerColor = isBlocked ? "#dc2626" : isArrived ? "#0a8754" : "#16a34a";

                return (
                  <CircleMarker
                    key={`truck-${truck.vehicleId}`}
                    center={[truck.lat, truck.lng]}
                    radius={isBlocked ? 9 : 8}
                    pathOptions={{
                      fillColor: markerColor,
                      fillOpacity: 1,
                      color: "#ffffff",
                      weight: 2.5,
                    }}
                  >
                    <Popup>
                      <div className="text-xs p-1 space-y-1.5 font-sans min-w-[190px]">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-gray-900">{truck.vehicleId}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isBlocked
                                ? "bg-red-100 text-red-700"
                                : isArrived
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {isBlocked
                              ? "BLOCKED (0 km/h)"
                              : isArrived
                                ? "ARRIVED"
                                : `MOVING (${truck.speed} km/h)`}
                          </span>
                        </div>
                        <div className="text-gray-600 text-[11px]">
                          <strong>Route:</strong> {truck.origin} &rarr; {truck.destination}
                          {truck.diverted && (
                            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-white bg-sky-600">
                              detour
                            </span>
                          )}
                        </div>
                        <div className="text-gray-600 text-[11px]">
                          <strong>Cargo:</strong> {truck.cargoType || "Relief materials"}
                        </div>
                        <div className="text-gray-400 font-mono text-[10px]">
                          GPS: {truck.lat.toFixed(4)}, {truck.lng.toFixed(4)}
                        </div>
                      </div>
                    </Popup>
                    <Tooltip direction="top" offset={[0, -8]} permanent>
                      <span className="font-mono text-[10px] font-bold px-1 py-0.5 rounded bg-white/90 text-gray-900 shadow">
                        {truck.vehicleId} ({isArrived ? "arrived" : `${truck.speed} km/h`})
                        {truck.diverted ? " • detour" : ""}
                      </span>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </div>

        {/* Right Col: What-If Stress Testing Knobs & Mock GPS Ingest */}
        <div className="space-y-6">
          {/* What-If Knobs Box */}
          <div
            className="rounded-2xl p-5 border shadow-sm space-y-4"
            style={{ background: c.cardBg, borderColor: c.cardBorder }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders size={16} className="text-amber-500" />
                <h3 className="font-extrabold text-sm" style={{ color: c.text }}>
                  What-If Scenario Knobs
                </h3>
              </div>
              {Object.keys(scenarioOverrides).length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600">
                  OVERRIDE ACTIVE
                </span>
              )}
            </div>

            <p className="text-xs" style={{ color: c.textMuted }}>
              Inject custom meteorological stress values to observe ML risk decisions (CRITICAL &rarr;
              block, HIGH &rarr; 20 km/h slow, normal &rarr; 40 km/h).
            </p>

            {/* Rainfall Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span style={{ color: c.text }}>Rainfall Volume:</span>
                <span className="font-mono font-bold text-blue-500">{rainfallOverride} mm</span>
              </div>
              <input
                type="range"
                min={0}
                max={350}
                step={10}
                value={rainfallOverride}
                onChange={(e) => setRainfallOverride(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>0mm (Dry)</span>
                <span>150mm (Monsoon)</span>
                <span>350mm (Cloudburst)</span>
              </div>
            </div>

            {/* River Danger Count */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span style={{ color: c.text }}>Rivers Above Danger Level:</span>
                <span className="font-mono font-bold text-red-500">{riverDangerOverride} Rivers</span>
              </div>
              <input
                type="range"
                min={0}
                max={8}
                step={1}
                value={riverDangerOverride}
                onChange={(e) => setRiverDangerOverride(Number(e.target.value))}
                className="w-full accent-red-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>0 (Normal)</span>
                <span>4 (High Flooding)</span>
                <span>8 (Catastrophic)</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={actionLoading || !isAdmin}
                onClick={handleApplyWhatIf}
                className="flex-1 py-2.5 px-3 rounded-xl font-bold text-white text-xs shadow hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                style={{ background: c.green || "#0a8754" }}
              >
                <Zap size={14} />
                <span>Apply What-If</span>
              </button>

              <button
                type="button"
                disabled={actionLoading || !isAdmin}
                onClick={handleResetWhatIf}
                className="py-2.5 px-3 rounded-xl font-semibold text-xs border transition-all hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
                style={{ borderColor: c.cardBorder, color: c.textMuted }}
                title="Clear scenario overrides"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* Mock GPS Ingest Tool (Admin) */}
          {isAdmin && (
            <div
              className="rounded-2xl p-5 border shadow-sm space-y-3"
              style={{ background: c.cardBg, borderColor: c.cardBorder }}
            >
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-blue-500" />
                <h3 className="font-extrabold text-sm" style={{ color: c.text }}>
                  Mock-GPS Ingestion (PROJECT.md §9)
                </h3>
              </div>

              <p className="text-[11px]" style={{ color: c.textMuted }}>
                Teleport a truck into coordinates to test instant safety radius calculation.
              </p>

              <div className="space-y-2">
                {GPS_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleInjectGps(p.vehicleId, p.lat, p.lng)}
                    className="w-full text-left p-2.5 rounded-xl border text-xs transition-all hover:opacity-90 cursor-pointer flex items-center justify-between"
                    style={{ background: "transparent", borderColor: c.cardBorder }}
                  >
                    <div>
                      <div className="font-bold" style={{ color: c.text }}>
                        {p.label}
                      </div>
                      <div className="text-[10px]" style={{ color: c.textMuted }}>
                        {p.desc}
                      </div>
                    </div>
                    <Send size={12} className="text-emerald-500 shrink-0 ml-2" />
                  </button>
                ))}
              </div>

              {/* Custom Coordinate Form */}
              <div className="pt-2 border-t space-y-2" style={{ borderColor: c.cardBorder }}>
                <div className="text-[11px] font-bold" style={{ color: c.text }}>
                  Custom Coordinates Ingest
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <input
                    type="text"
                    value={customVehicleId}
                    onChange={(e) => setCustomVehicleId(e.target.value)}
                    placeholder="Vehicle ID"
                    className="p-1.5 rounded-lg border text-[11px]"
                    style={{ borderColor: c.cardBorder, color: c.text }}
                  />
                  <input
                    type="text"
                    value={customLat}
                    onChange={(e) => setCustomLat(e.target.value)}
                    placeholder="Lat"
                    className="p-1.5 rounded-lg border text-[11px]"
                    style={{ borderColor: c.cardBorder, color: c.text }}
                  />
                  <input
                    type="text"
                    value={customLng}
                    onChange={(e) => setCustomLng(e.target.value)}
                    placeholder="Lng"
                    className="p-1.5 rounded-lg border text-[11px]"
                    style={{ borderColor: c.cardBorder, color: c.text }}
                  />
                </div>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleInjectGps(customVehicleId, customLat, customLng)}
                  className="w-full py-1.5 rounded-lg text-xs font-bold border transition-all hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
                  style={{ borderColor: c.cardBorder, color: c.text }}
                >
                  Send Custom Position
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Live Simulated Fleet Telemetry Table ───────────────────── */}
      <div
        className="rounded-2xl border shadow-sm overflow-hidden"
        style={{ background: c.cardBg, borderColor: c.cardBorder }}
      >
        <div
          className="p-4 border-b flex items-center justify-between"
          style={{ borderColor: c.cardBorder }}
        >
          <div className="flex items-center gap-2">
            <Truck size={17} className="text-emerald-500" />
            <h3 className="font-extrabold text-sm sm:text-base" style={{ color: c.text }}>
              Simulated Fleet Telemetry Board
            </h3>
          </div>
          <span className="text-xs font-mono text-gray-400">
            Auto-syncing every 2000ms
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr
                className="border-b text-[11px] uppercase tracking-wider font-bold"
                style={{ borderColor: c.cardBorder, color: c.textMuted }}
              >
                <th className="p-3.5 pl-5">Vehicle ID</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Telemetry Speed</th>
                <th className="p-3.5">Corridor Route</th>
                <th className="p-3.5">Cargo Manifest</th>
                <th className="p-3.5">District / ML Assessment</th>
                <th className="p-3.5 pr-5">GPS Coordinates</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: c.cardBorder }}>
              {displayedVehicles.map((v) => {
                const isBlocked = v.status === "blocked";
                const isArrived = v.status === "idle";
                const riskInfo = mlRisk[v.vehicleId] || {};

                return (
                  <tr
                    key={v.vehicleId}
                    className="hover:bg-gray-500/5 transition-colors"
                  >
                    <td className="p-3.5 pl-5 font-mono font-bold" style={{ color: c.text }}>
                      {v.vehicleId}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          isBlocked
                            ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isBlocked ? "bg-red-500" : isArrived ? "bg-emerald-600" : "bg-emerald-500 animate-ping"
                          }`}
                        />
                        {isBlocked ? "BLOCKED" : isArrived ? "ARRIVED" : v.diverted ? "ON DETOUR" : "MOVING"}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-semibold" style={{ color: c.text }}>
                      {v.speed ?? 0} km/h
                    </td>
                    <td className="p-3.5" style={{ color: c.text }}>
                      <div className="font-semibold">{v.origin} &rarr; {v.destination}</div>
                    </td>
                    <td className="p-3.5 font-medium text-gray-500 dark:text-gray-400">
                      {v.cargoType || "Relief supplies"}
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium" style={{ color: c.text }}>
                          {riskInfo.district || "NER Corridor"}
                        </span>
                        {riskInfo.band && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600">
                            [{riskInfo.band}]
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 pr-5 font-mono text-xs text-gray-400">
                      {v.lat.toFixed(4)}°N, {v.lng.toFixed(4)}°E
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
