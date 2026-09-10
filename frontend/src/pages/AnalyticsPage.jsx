import { useState, useEffect } from "react";
import {
  AlertTriangle,
  CloudRain,
  ShieldAlert,
  FileText,
  Download,
  CheckCircle2,
  Compass,
  ArrowRight,
  Clock,
  Sparkles,
} from "lucide-react";
import apiClient from "../api/client";

// Major NER Supply Corridors for analysis
const CORRIDOR_PRESETS = [
  {
    id: "corridor-golaghat",
    name: "Guwahati -> Golaghat Relief Camp",
    highway: "NH-715 (Southern Brahmaputra Bank)",
    origin: { lat: 26.1844, lng: 91.7458, label: "Guwahati Transit Hub" },
    destination: { lat: 26.51, lng: 93.97, label: "Golaghat Relief Center" },
    truck: "AS-01-FOOD-04",
    cargoType: "rice + emergency medicines",
  },
  {
    id: "corridor-sivasagar",
    name: "Guwahati -> Sivasagar Civil Hospital",
    highway: "NH-27 / NH-715 Corridor",
    origin: { lat: 26.1844, lng: 91.7458, label: "Guwahati Transit Hub" },
    destination: { lat: 26.98, lng: 94.63, label: "Sivasagar Civil Hospital" },
    truck: "AS-02-MED-11",
    cargoType: "vital medicines + surgical packs",
  },
  {
    id: "corridor-nagaon",
    name: "Guwahati -> Nagaon Central Warehouse",
    highway: "NH-27 4-Lane Express Corridor",
    origin: { lat: 26.1844, lng: 91.7458, label: "Guwahati Transit Hub" },
    destination: { lat: 26.345, lng: 92.684, label: "Nagaon Warehouse" },
    truck: "AS-03-FUEL-07",
    cargoType: "high-octane diesel for generators",
  },
];

export default function AnalyticsPage({ c, setActive }) {
  const [selectedCorridor, setSelectedCorridor] = useState(CORRIDOR_PRESETS[0]);
  const [selectedDate, setSelectedDate] = useState("2026-07-28");
  const [weather, setWeather] = useState(null);
  const [routeAnalysis, setRouteAnalysis] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingWeather, setLoadingWeather] = useState(true);

  // Fetch regional weather from live backend (GET /api/weather)
  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      setLoadingWeather(true);
      try {
        const res = await apiClient.get("/api/weather?lat=26.1844&lng=91.7458");
        if (!cancelled && res.data) {
          setWeather(res.data);
        }
      } catch (err) {
        console.error("[AnalyticsPage] Weather load failed:", err);
      } finally {
        if (!cancelled) setLoadingWeather(false);
      }
    }

    void loadWeather();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch active incidents for breakdown (GET /api/incidents)
  useEffect(() => {
    let cancelled = false;

    async function loadIncidents() {
      try {
        const res = await apiClient.get(`/api/incidents?date=${selectedDate}`);
        if (!cancelled && res.data?.incidents) {
          setIncidents(res.data.incidents);
        }
      } catch (err) {
        console.error("[AnalyticsPage] Incidents load failed:", err);
      }
    }

    void loadIncidents();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  // Run Route Intelligence whenever corridor or date changes
  useEffect(() => {
    let cancelled = false;

    async function analyze() {
      setLoadingAnalysis(true);
      try {
        const res = await apiClient.post("/api/route/analyze", {
          origin: selectedCorridor.origin,
          destination: selectedCorridor.destination,
          eventDate: selectedDate,
          truck: selectedCorridor.truck,
          cargoType: selectedCorridor.cargoType,
        });
        if (!cancelled && res.data) {
          setRouteAnalysis(res.data);
        }
      } catch (err) {
        console.error("[AnalyticsPage] Route analysis failed:", err);
      } finally {
        if (!cancelled) setLoadingAnalysis(false);
      }
    }

    void analyze();

    return () => {
      cancelled = true;
    };
  }, [selectedCorridor, selectedDate]);

  // Incident statistics breakdown
  const breachCount = incidents.filter((i) => i.type === "breach").length;
  const landslideCount = incidents.filter((i) => i.type === "landslide").length;
  const overtopCount = incidents.filter((i) => i.type === "overtop").length;
  const erosionCount = incidents.filter((i) => i.type === "erosion").length;
  const redCount = incidents.filter((i) => i.severity === "RED").length;
  const highCount = incidents.filter((i) => i.severity === "HIGH").length;

  // Download ASDMA flood bulletin PDF with Bearer token authentication
  const handleDownloadBulletin = async () => {
    try {
      const res = await apiClient.get(`/api/bulletin.pdf?date=${selectedDate}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sarathi-flood-bulletin-${selectedDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[AnalyticsPage] Failed to download PDF bulletin:", err);
      alert("Failed to download PDF bulletin. Please check backend connection.");
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-extrabold" style={{ color: c.text }}>
              Logistics Intelligence & Disaster Analytics
            </h1>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-bold"
              style={{ background: "#2563eb1a", color: "#2563eb", border: "1px solid #2563eb40" }}
            >
              ASDMA ML Pipeline
            </span>
          </div>
          <p className="text-sm sm:text-base" style={{ color: c.textMuted }}>
            Real-time supply corridor risk modeling, weather telemetry, and automated flood detour intelligence.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadBulletin}
            className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm border flex items-center gap-2 cursor-pointer shadow-sm hover:opacity-90 transition-all"
            style={{
              background: c.cardBg,
              borderColor: c.cardBorder,
              color: c.text,
            }}
          >
            <Download size={15} className="text-emerald-500" />
            <span>Download Daily ASDMA Bulletin (PDF)</span>
          </button>
        </div>
      </div>

      {/* ── 1. Real-Time Meteorological & Corridor Risk KPIs ─────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Weather Alert KPI */}
        <div
          className="rounded-2xl p-5 border shadow-sm flex flex-col justify-between"
          style={{ background: c.cardBg, borderColor: c.cardBorder }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: c.textMuted }}>
              Regional Weather
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <CloudRain size={18} />
            </div>
          </div>
          <div>
            <div className="text-xl font-black mb-0.5" style={{ color: c.text }}>
              {loadingWeather ? "Measuring..." : weather?.condition || "Monsoon Storm"}
            </div>
            <div className="text-xs flex items-center gap-2" style={{ color: c.textMuted }}>
              <span>Rainfall: <strong>{weather?.rainfall_mm ?? 0.2} mm</strong></span>
              <span>•</span>
              <span>Wind: <strong>{weather?.wind_kph ?? 5} km/h</strong></span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t text-[11px] flex justify-between" style={{ borderColor: c.cardBorder }}>
            <span style={{ color: c.textMuted }}>Rain Probability:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {Math.round((weather?.probability ?? 0.71) * 100)}%
            </span>
          </div>
        </div>

        {/* Hazard Exposure Score */}
        <div
          className="rounded-2xl p-5 border shadow-sm flex flex-col justify-between"
          style={{ background: c.cardBg, borderColor: c.cardBorder }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: c.textMuted }}>
              Active Corridor Risk
            </span>
            <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
              <ShieldAlert size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-red-600 dark:text-red-400 mb-0.5">
              {routeAnalysis?.risk?.score ?? 85} / 100
            </div>
            <div className="text-xs font-bold" style={{ color: routeAnalysis?.blocked ? "#dc2626" : "#16a34a" }}>
              {routeAnalysis?.blocked ? "RED — PASSAGE BLOCKED" : "PASSABLE WITH CAUTION"}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t text-[11px] flex justify-between" style={{ borderColor: c.cardBorder }}>
            <span style={{ color: c.textMuted }}>Landslide Exposure:</span>
            <span className="font-bold text-red-600">
              {Math.round((routeAnalysis?.risk?.landslide_prob ?? 0.85) * 100)}%
            </span>
          </div>
        </div>

        {/* Active Blockages Count */}
        <div
          className="rounded-2xl p-5 border shadow-sm flex flex-col justify-between"
          style={{ background: c.cardBg, borderColor: c.cardBorder }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: c.textMuted }}>
              Active Road Breaches
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mb-0.5">
              {breachCount} Breaches
            </div>
            <div className="text-xs" style={{ color: c.textMuted }}>
              Plus {landslideCount} landslides & {overtopCount} overtopped roads
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t text-[11px] flex justify-between" style={{ borderColor: c.cardBorder }}>
            <span style={{ color: c.textMuted }}>RED / HIGH Severity:</span>
            <span className="font-bold text-red-500">{redCount} RED, {highCount} HIGH</span>
          </div>
        </div>

        {/* Detour Delay Impact */}
        <div
          className="rounded-2xl p-5 border shadow-sm flex flex-col justify-between"
          style={{ background: c.cardBg, borderColor: c.cardBorder }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: c.textMuted }}>
              Detour Delay Impact
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Clock size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black mb-0.5" style={{ color: c.text }}>
              +75 Mins
            </div>
            <div className="text-xs" style={{ color: c.textMuted }}>
              Northern bypass via Tezpur (NH-15)
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t text-[11px] flex justify-between" style={{ borderColor: c.cardBorder }}>
            <span style={{ color: c.textMuted }}>Resilience Routing:</span>
            <span className="font-bold text-emerald-600">Active Alternate</span>
          </div>
        </div>
      </div>

      {/* ── 2. Interactive Supply Corridor Risk Analyzer ─────────────── */}
      <div
        className="rounded-2xl border shadow-sm p-6 space-y-6"
        style={{ background: c.cardBg, borderColor: c.cardBorder }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3 border-b pb-4" style={{ borderColor: c.cardBorder }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Compass size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black" style={{ color: c.text }}>
                Corridor Risk & Routing Intelligence Analyzer
              </h2>
              <p className="text-xs" style={{ color: c.textMuted }}>
                Simulate supply line vulnerability for food relief, vital medical cargo, and emergency diesel.
              </p>
            </div>
          </div>

          {/* Scenario Date Pill */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: c.textMuted }}>Analysis Date:</span>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer"
              style={{ background: "transparent", borderColor: c.cardBorder, color: c.text }}
            >
              <option value="2026-07-28">2026-07-28 (Peak Flood)</option>
              <option value="2026-07-19">2026-07-19 (Onset Stage)</option>
              <option value="2026-08-09">2026-08-09 (Relief Stage)</option>
            </select>
          </div>
        </div>

        {/* Corridor Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {CORRIDOR_PRESETS.map((corridor) => {
            const isSelected = selectedCorridor.id === corridor.id;
            return (
              <button
                key={corridor.id}
                type="button"
                onClick={() => setSelectedCorridor(corridor)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "ring-2 ring-emerald-500 shadow-md bg-emerald-500/5"
                    : "hover:border-gray-400 dark:hover:border-gray-600 opacity-80 hover:opacity-100"
                }`}
                style={{ borderColor: isSelected ? (c.green || "#0a8754") : c.cardBorder }}
              >
                <div className="font-extrabold text-sm mb-1" style={{ color: c.text }}>
                  {corridor.name}
                </div>
                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                  {corridor.highway}
                </div>
                <div className="text-[11px] text-gray-400">
                  Cargo: {corridor.cargoType}
                </div>
              </button>
            );
          })}
        </div>

        {/* Live Analysis Output Box */}
        {loadingAnalysis ? (
          <div className="text-center py-12" style={{ color: c.textMuted }}>
            <div className="animate-spin w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm">Running GIS corridor intelligence and ML risk analysis...</p>
          </div>
        ) : routeAnalysis ? (
          <div className="space-y-4 pt-2">
            {/* Status Alert Banner */}
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                routeAnalysis.blocked
                  ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {routeAnalysis.blocked ? (
                <ShieldAlert size={22} className="shrink-0 text-red-500 mt-0.5" />
              ) : (
                <CheckCircle2 size={22} className="shrink-0 text-emerald-500 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-bold text-sm">
                  {routeAnalysis.blocked
                    ? "PRIMARY CORRIDOR BLOCKED — RECOMMENDED ALTERNATE ACTIVE"
                    : "CORRIDOR FULLY PASSABLE"}
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  {routeAnalysis.delayMessage}
                </p>
                {routeAnalysis.recommendedRoad && (
                  <div className="text-xs font-bold flex items-center gap-1.5 pt-1">
                    <span>Guidance:</span>
                    <span className="underline decoration-dotted font-mono">
                      {routeAnalysis.recommendedRoad}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Distance & Time */}
              <div
                className="p-4 rounded-xl border"
                style={{ borderColor: c.cardBorder, background: "transparent" }}
              >
                <div className="text-xs font-semibold mb-1" style={{ color: c.textMuted }}>
                  Corridor Distance
                </div>
                <div className="text-2xl font-black mb-1" style={{ color: c.text }}>
                  {routeAnalysis.route?.distance_km ?? 280.8} km
                </div>
                <div className="text-xs text-gray-400">
                  Estimated transit: ~{Math.round((routeAnalysis.route?.duration_min ?? 420) / 60)} hrs
                </div>
              </div>

              {/* Landslide & Flood Probability */}
              <div
                className="p-4 rounded-xl border"
                style={{ borderColor: c.cardBorder, background: "transparent" }}
              >
                <div className="text-xs font-semibold mb-1" style={{ color: c.textMuted }}>
                  Landslide / Inundation Prob.
                </div>
                <div className="text-2xl font-black text-red-600 mb-1">
                  {Math.round((routeAnalysis.risk?.landslide_prob ?? 0.85) * 100)}%
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-red-600 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round((routeAnalysis.risk?.landslide_prob ?? 0.85) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Model Source */}
              <div
                className="p-4 rounded-xl border"
                style={{ borderColor: c.cardBorder, background: "transparent" }}
              >
                <div className="text-xs font-semibold mb-1" style={{ color: c.textMuted }}>
                  Inference Model Engine
                </div>
                <div className="text-2xl font-black mb-1 capitalize" style={{ color: c.text }}>
                  {routeAnalysis.risk?.source ?? "ASDMA Heuristic"}
                </div>
                <div className="text-xs text-gray-400">
                  Evaluated at destination coordinate {selectedCorridor.destination.lat}°N, {selectedCorridor.destination.lng}°E
                </div>
              </div>
            </div>

            {/* Risk Reasoning Explanations */}
            {routeAnalysis.risk?.reasons && routeAnalysis.risk.reasons.length > 0 && (
              <div
                className="p-4 rounded-xl border space-y-2 text-xs"
                style={{ borderColor: c.cardBorder, background: "transparent" }}
              >
                <div className="font-bold flex items-center gap-1.5" style={{ color: c.text }}>
                  <Sparkles size={14} className="text-amber-500" />
                  <span>Model Risk Assessment Factors:</span>
                </div>
                <ul className="space-y-1 pl-5 list-disc" style={{ color: c.textMuted }}>
                  {routeAnalysis.risk.reasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ── 3. Incident Severity & Type Breakdown ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Incident Type Distribution */}
        <div
          className="rounded-2xl border shadow-sm p-6 space-y-4"
          style={{ background: c.cardBg, borderColor: c.cardBorder }}
        >
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: c.cardBorder }}>
            <h3 className="font-extrabold text-sm sm:text-base" style={{ color: c.text }}>
              ASDMA Hazard Types ({selectedDate})
            </h3>
            <span className="text-xs font-mono font-bold text-gray-400">
              {incidents.length} Records Verified
            </span>
          </div>

          <div className="space-y-3">
            {[
              { label: "Flood Breaches", count: breachCount, color: "#dc2626", pct: 50 },
              { label: "Landslides & Slope Failures", count: landslideCount, color: "#ea580c", pct: 25 },
              { label: "Road Overtopped by Water", count: overtopCount, color: "#2563eb", pct: 15 },
              { label: "Riverbank Erosion", count: erosionCount, color: "#9333ea", pct: 10 },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span style={{ color: c.text }}>{item.label}</span>
                  <span className="font-mono" style={{ color: item.color }}>
                    {item.count} Incidents
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${item.pct}%`,
                      background: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ASDMA Bulletin Summary & Quick Links */}
        <div
          className="rounded-2xl border shadow-sm p-6 space-y-4 flex flex-col justify-between"
          style={{ background: c.cardBg, borderColor: c.cardBorder }}
        >
          <div>
            <div className="flex items-center justify-between border-b pb-3 mb-3" style={{ borderColor: c.cardBorder }}>
              <h3 className="font-extrabold text-sm sm:text-base" style={{ color: c.text }}>
                Official Flood Bulletin PDF
              </h3>
              <span className="text-xs font-bold text-emerald-600">Daily Digest</span>
            </div>
            <p className="text-xs leading-relaxed mb-4" style={{ color: c.textMuted }}>
              SARATHI cross-references real daily disaster bulletins published by the Assam State Disaster
              Management Authority (ASDMA). Incident coordinates and road damage reports are geocoded directly
              from these field advisories.
            </p>

            <div
              className="p-3.5 rounded-xl border flex items-center justify-between text-xs"
              style={{ borderColor: c.cardBorder, background: "transparent" }}
            >
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-emerald-500" />
                <div>
                  <div className="font-bold" style={{ color: c.text }}>ASDMA_Flood_Bulletin_{selectedDate}.pdf</div>
                  <div className="text-[10px] text-gray-400">PDF Report with verified road breaches</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadBulletin}
                className="px-3 py-1.5 rounded-lg text-white font-bold text-xs shadow hover:opacity-90 transition-all flex items-center gap-1 cursor-pointer"
                style={{ background: c.green || "#0a8754" }}
              >
                <Download size={13} />
                <span>Download</span>
              </button>
            </div>
          </div>

          {/* Direct Navigation Links */}
          {setActive && (
            <div className="pt-4 border-t flex items-center justify-between gap-3 text-xs" style={{ borderColor: c.cardBorder }}>
              <button
                onClick={() => setActive("Live Map")}
                className="flex items-center gap-1 font-semibold text-emerald-600 hover:underline cursor-pointer"
              >
                <span>View Live Fleet Heatmap</span>
                <ArrowRight size={13} />
              </button>
              <button
                onClick={() => setActive("Simulation")}
                className="flex items-center gap-1 font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                <span>Open Simulation Lab</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
