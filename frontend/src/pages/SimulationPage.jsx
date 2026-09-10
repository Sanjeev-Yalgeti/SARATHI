import { CloudSun, TrafficCone, Car, Timer, Play, RotateCcw } from "lucide-react";

const INFO_ROWS = [
  { icon: CloudSun,     label: "Weather",         value: "Heavy Rain" },
  { icon: TrafficCone,  label: "Road Condition",  value: "Landslide Risk" },
  { icon: Car,          label: "Traffic",         value: "Moderate" },
  { icon: Timer,        label: "Estimated Delay", value: "45 mins" },
];

export default function SimulationPage({ c }) {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <h1 className="text-3xl font-extrabold mb-1" style={{ color: c.text }}>
        Driver Simulation
      </h1>
      <p className="mb-6" style={{ color: c.textMuted }}>
        Realistic driving simulation with AI route guidance
      </p>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Info Panel */}
        <div
          className="w-full md:w-80 shrink-0 rounded-2xl p-6 flex flex-col gap-6"
          style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}
        >
          {INFO_ROWS.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#0a8754]/10 text-[#0a8754]">
                <Icon size={20} />
              </div>
              <div>
                <div className="text-sm" style={{ color: c.textMuted }}>{label}</div>
                <div className="font-bold text-base" style={{ color: c.text }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Map Placeholder */}
        <div
          className="flex-1 rounded-2xl flex items-center justify-center text-base font-medium"
          style={{
            minHeight: "360px",
            background: c.placeholderBg,
            color: c.placeholderText,
            border: `1px solid ${c.cardBorder}`,
          }}
        >
          Live Simulation Map Environment
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-4 mt-8">
        <button
          className="px-8 py-3 rounded-full text-white font-bold flex items-center gap-2 cursor-pointer shadow-md hover:opacity-90"
          style={{ background: c.green }}
        >
          <Play size={16} /> Start Simulation
        </button>
        <button
          className="px-8 py-3 rounded-full text-white font-bold flex items-center gap-2 cursor-pointer shadow-md hover:opacity-90"
          style={{ background: c.orange }}
        >
          <RotateCcw size={16} /> End Simulation
        </button>
      </div>
    </div>
  );
}

