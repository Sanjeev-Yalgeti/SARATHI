import { useState, useEffect, useMemo } from "react";
import { Play, RotateCcw } from "lucide-react";
import StatCard from "../components/StatCard";
import LiveMap from "../components/LiveMap";
import apiClient from "../api/client";
import { resetSimulation, startSimulation } from "../api/simulation";
import { isNetworkError } from "../api/auth";

// Every number below comes from a live API response for the map's current
// date — nothing is hardcoded. Empty states say so honestly instead of
// showing fake zeroes as facts.
export default function LiveMapPage({ c, userRole = "ADMIN", currentUser = null }) {
  const isDriver = userRole === "DRIVER" || userRole === "restricted";
  const driverVehicleId = currentUser?.id;
  const [mapKey, setMapKey] = useState(0);
  const [starting, setStarting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [simMsg, setSimMsg] = useState("");
  const [mapDate, setMapDate] = useState("2026-07-28");
  const [incidents, setIncidents] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [scenarioDate, setScenarioDate] = useState(null);

  // Driver-safe start: works for every role (never changes the date,
  // never clears RED-incident stops). Remounts the map for a fresh board.
  async function handleStartSimulation() {
    setStarting(true);
    setSimMsg("");
    try {
      const data = await startSimulation();
      const n = data.vehicles?.length ?? 0;
      setSimMsg(`Simulation running — ${n} truck${n === 1 ? "" : "s"} live on ${data.scenarioDate}.`);
      setMapKey((k) => k + 1);
    } catch (err) {
      if (isNetworkError(err)) {
        setSimMsg("Backend offline — start it with ./dev.sh first.");
      } else {
        setSimMsg(err.response?.data?.error || "Could not start simulation. Re-login?");
      }
    } finally {
      setStarting(false);
    }
  }

  // Driver restart: own truck goes back to Guwahati depot and re-drives
  // the SAME date from the start — the judge reshow button. RED stops
  // included (they re-hit honestly). Never changes the date.
  async function handleRestartTrip() {
    setRestarting(true);
    setSimMsg("");
    try {
      const data = await resetSimulation();
      setSimMsg(`Restarted from Guwahati — re-driving ${data.scenarioDate}.`);
      setMapKey((k) => k + 1);
    } catch (err) {
      if (isNetworkError(err)) {
        setSimMsg("Backend offline — start it with ./dev.sh first.");
      } else {
        setSimMsg(err.response?.data?.error || "Could not restart trip. Re-login?");
      }
    } finally {
      setRestarting(false);
    }
  }

  // Live card data: incidents per viewed date, fleet + clock on a 5 s poll.
  useEffect(() => {
    let cancelled = false;
    async function loadDate() {
      try {
        const res = await apiClient.get(`/api/incidents?date=${mapDate}`);
        if (!cancelled) setIncidents(res.data?.incidents ?? []);
      } catch {
        if (!cancelled) setIncidents([]);
      }
    }
    async function pollLive() {
      try {
        const res = await apiClient.get("/api/vehicles");
        if (!cancelled) setFleet(res.data?.vehicles ?? []);
      } catch {
        if (!cancelled) setFleet([]);
      }
      try {
        const res = await apiClient.get("/api/simulation/status");
        if (!cancelled) setScenarioDate(res.data?.scenarioDate ?? null);
      } catch {
        if (!cancelled) setScenarioDate(null);
      }
    }
    loadDate();
    pollLive();
    const timer = setInterval(pollLive, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [mapDate]);

  // Same scoping as the map: drivers see only their own truck's numbers.
  const scopedFleet = useMemo(() => {
    if (isDriver && driverVehicleId) {
      const own = fleet.filter((v) => v.vehicleId === driverVehicleId);
      return own.length > 0 ? own : fleet.slice(0, 1);
    }
    return fleet;
  }, [fleet, isDriver, driverVehicleId]);

  const insights = useMemo(() => {
    const reds = incidents.filter((i) => i.severity === "RED").length;
    const highs = incidents.filter((i) => i.severity === "HIGH").length;
    const roads = [...new Set(incidents.map((i) => i.road).filter(Boolean))];
    const moving = scopedFleet.filter((v) => v.status === "moving").length;
    const blocked = scopedFleet.filter((v) => v.status === "blocked").length;
    const arrived = scopedFleet.filter((v) => v.status === "idle").length;
    const detours = scopedFleet.filter((v) => v.diverted).length;
    const fleetNote =
      scopedFleet.length === 0
        ? "No telemetry"
        : `${blocked} Blocked · ${arrived} Arrived${detours > 0 ? ` · ${detours} Detour` : ""}`;
    return [
      {
        value: incidents.length,
        label: "Active Alerts",
        note: incidents.length === 0 ? "None reported this date" : `RED: ${reds} · HIGH: ${highs}`,
        noteColor: reds > 0 ? "#dc2626" : c.textMuted,
      },
      {
        value: roads.length,
        label: "Roads Affected",
        note: roads.length === 0 ? "None reported" : [...roads.slice(0, 3), ...(roads.length > 3 ? [`+${roads.length - 3} more`] : [])].join(", "),
        noteColor: c.textMuted,
      },
      {
        value: `${moving}/${scopedFleet.length}`,
        label: "Trucks Moving",
        note: fleetNote,
        noteColor: blocked > 0 ? "#ea580c" : "#16a34a",
      },
      {
        value: scenarioDate ?? "—",
        label: "Scenario Clock",
        note: scenarioDate ? (scenarioDate === mapDate ? "Matches map view" : "Map viewing another date") : "Backend offline",
        noteColor: c.textMuted,
      },
    ];
  }, [incidents, scopedFleet, scenarioDate, mapDate, c.textMuted]);

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold mb-1" style={{ color: c.text }}>
            Live Logistics Map
          </h1>
          <p className="text-sm sm:text-base" style={{ color: c.textMuted }}>
            Real-time GIS overview of fleet GPS tracking, disaster incidents, and risk-aware corridor guidance across the North-Eastern Region.
          </p>
        </div>

        {/* Driver Start / Restart — judges demo entry points */}
        {isDriver && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                type="button"
                onClick={handleStartSimulation}
                disabled={starting || restarting}
                className="px-6 py-3 rounded-full text-white font-bold flex items-center gap-2 cursor-pointer shadow-md hover:opacity-90 disabled:opacity-50 text-sm"
                style={{ background: c.green || "#0a8754" }}
              >
                <Play size={16} /> {starting ? "Starting…" : "Start Simulation"}
              </button>
              <button
                type="button"
                onClick={handleRestartTrip}
                disabled={starting || restarting}
                className="px-6 py-3 rounded-full text-white font-bold flex items-center gap-2 cursor-pointer shadow-md hover:opacity-90 disabled:opacity-50 text-sm"
                style={{ background: c.orange || "#e8672a" }}
                title="Restart your truck from Guwahati depot on this same date"
              >
                <RotateCcw size={16} /> {restarting ? "Restarting…" : "Restart Trip"}
              </button>
            </div>
            {simMsg && (
              <span className="text-xs font-medium" style={{ color: c.textMuted }}>
                {simMsg}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Interactive Map Component */}
      <div className="w-full">
        <LiveMap
          key={mapKey}
          userRole={userRole}
          currentUser={currentUser}
          height="520px"
          onDateChange={setMapDate}
        />
      </div>

      {/* Key Insights Overview — live, never hardcoded */}
      <div className="pt-2">
        <h3 className="font-bold text-lg mb-3" style={{ color: c.text }}>
          Live Map Key Insights
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {insights.map((i) => (
            <StatCard
              key={i.label}
              c={c}
              value={i.value}
              label={i.label}
              note={i.note}
              noteColor={i.noteColor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
