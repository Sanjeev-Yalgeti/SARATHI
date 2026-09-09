import { CloudSun, TrafficCone, Car, Timer } from "lucide-react";
import Sidebar from "../components/Sidebar";

const SIDEBAR_ITEMS = [
  "Driver Simulation",
  "Scenario Library",
  "My Simulations",
  "Leaderboard",
];

const INFO_ROWS = [
  { icon: CloudSun, label: "Weather", value: "Heavy Rain" },
  { icon: TrafficCone, label: "Road Condition", value: "Landslide Risk" },
  { icon: Car, label: "Traffic", value: "Moderate" },
  { icon: Timer, label: "Estimated Delay", value: "45 mins" },
];

export default function AnalyticsPage({ c, sub, setSub }) {
  return (
    <div className="flex">
      <Sidebar c={c} title="Simulation" items={SIDEBAR_ITEMS} active={sub} setActive={setSub} />
      <div className="flex-1">
        <h1 className="text-3xl font-extrabold mb-1" style={{ color: c.text }}>
          Driver Simulation
        </h1>
        <p className="mb-5" style={{ color: c.textMuted }}>
          Realistic driving simulation with AI route guidance
        </p>

        <div className="flex gap-6">
          {/* Info Panel */}
          <div
            className="w-72 shrink-0 rounded-2xl p-6 flex flex-col gap-6"
            style={{ background: c.sidebarBg }}
          >
            {INFO_ROWS.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon size={18} className="mt-0.5" color="#fff" />
                <div>
                  <div className="text-sm" style={{ color: c.sidebarText }}>
                    {label}
                  </div>
                  <div className="text-white font-bold">{value}</div>
                </div>
              </div>
            ))}
          </div>


        </div>

        <div className="flex justify-center mt-6">
          <button
            className="px-8 py-3 rounded-full text-white font-bold"
            style={{ background: c.orange }}
          >
            End Simulation
          </button>
        </div>
      </div>
    </div>
  );
}
