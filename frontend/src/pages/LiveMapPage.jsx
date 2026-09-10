import { useState } from "react";
import { Play } from "lucide-react";
import StatCard from "../components/StatCard";
import LiveMap from "../components/LiveMap";
import { startSimulation } from "../api/simulation";
import { isNetworkError } from "../api/auth";

export default function LiveMapPage({ c, userRole = "ADMIN", currentUser = null }) {
  const isDriver = userRole === "DRIVER" || userRole === "restricted";
  const [mapKey, setMapKey] = useState(0);
  const [starting, setStarting] = useState(false);
  const [simMsg, setSimMsg] = useState("");

  const insights = [
    { value: 8, label: "Total Active Alerts", note: "High Priority: 7", noteColor: "#dc2626" },
    { value: 5, label: "Roads Affected", note: "NH-715, NH-15, NH-37", noteColor: c.textMuted },
    { value: 3, label: "Trucks En Route", note: "1 Blocked, 2 Moving", noteColor: "#ea580c" },
    { value: 4, label: "Weather Warnings", note: "Active Monsoon Alert", noteColor: "#16a34a" },
  ];

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

        {/* Driver Start Simulation — judges demo entry point */}
        {isDriver && (
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={handleStartSimulation}
              disabled={starting}
              className="px-6 py-3 rounded-full text-white font-bold flex items-center gap-2 cursor-pointer shadow-md hover:opacity-90 disabled:opacity-50 text-sm"
              style={{ background: c.green || "#0a8754" }}
            >
              <Play size={16} /> {starting ? "Starting…" : "Start Simulation"}
            </button>
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
        />
      </div>

      {/* Key Insights Overview */}
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
