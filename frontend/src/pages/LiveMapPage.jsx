import Sidebar from "../components/Sidebar";
import StatCard from "../components/StatCard";

const SIDEBAR_ITEMS = [
  "Map Overview",
  "Traffic Layer",
  "Weather Layer",
  "Risk Layer",
  "Road Status",
  "Checkpoints",
  "CCTV Feeds",
];

export default function LiveMapPage({ c, sub, setSub }) {
  const insights = [
    { value: 8, label: "Total Active Alerts", note: "High Priority: 7", noteColor: "#dc2626" },
    { value: 8, label: "Roads Affected", note: "Across NER", noteColor: c.textMuted },
    { value: 8, label: "Landslide Risk Areas", note: "High Risk", noteColor: "#dc2626" },
    { value: 8, label: "Weather Warnings", note: "Active Now", noteColor: "#16a34a" },
  ];

  return (
    <div className="flex">
      <Sidebar c={c} title="Live Map" items={SIDEBAR_ITEMS} active={sub} setActive={setSub} />
      <div className="flex-1">
        <h1 className="text-3xl font-extrabold mb-1" style={{ color: c.text }}>
          Live Logistics Map
        </h1>
        <p className="mb-5" style={{ color: c.textMuted }}>
          Real-time overview of traffic, weather &amp; disruptions across NER
        </p>

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
