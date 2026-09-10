import { CloudSun, TrafficCone, Car, Timer } from "lucide-react";

const INFO_ROWS = [
  { icon: CloudSun, label: "Weather", value: "Heavy Rain" },
  { icon: TrafficCone, label: "Road Condition", value: "Landslide Risk" },
  { icon: Car, label: "Traffic", value: "Moderate" },
  { icon: Timer, label: "Estimated Delay", value: "45 mins" },
];

export default function AnalyticsPage({ c }) {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-1" style={{ color: c.text }}>
        Analytics &amp; Simulation
      </h1>
      <p className="mb-6" style={{ color: c.textMuted }}>
        Realistic driving simulation and logistics route intelligence
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
                <div className="text-sm" style={{ color: c.textMuted }}>
                  {label}
                </div>
                <div className="font-bold text-base" style={{ color: c.text }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Analytics Card Area */}
        <div
          className="flex-1 rounded-2xl p-8 flex items-center justify-center min-h-[300px]"
          style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}
        >
          <div className="text-center">
            <div className="text-lg font-bold mb-2" style={{ color: c.text }}>Logistics Analytics Overview</div>
            <p className="text-sm" style={{ color: c.textMuted }}>Aggregated telemetry, predictive travel times, and road hazard analytics across NER routes.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-center mt-8">
        <button
          className="px-8 py-3 rounded-full text-white font-bold transition-transform hover:scale-105 cursor-pointer"
          style={{ background: c.orange }}
        >
          End Simulation
        </button>
      </div>
    </div>
  );
}

