import StatCard from "../components/StatCard";

export default function LiveMapPage({ c }) {
  const insights = [
    { value: 8, label: "Total Active Alerts", note: "High Priority: 7", noteColor: "#dc2626" },
    { value: 8, label: "Roads Affected", note: "Across NER", noteColor: c.textMuted },
    { value: 8, label: "Landslide Risk Areas", note: "High Risk", noteColor: "#dc2626" },
    { value: 8, label: "Weather Warnings", note: "Active Now", noteColor: "#16a34a" },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-1" style={{ color: c.text }}>
        Live Logistics Map
      </h1>
      <p className="mb-6" style={{ color: c.textMuted }}>
        Real-time overview of traffic, weather &amp; disruptions across NER
      </p>

      <h3 className="font-bold text-lg mb-4" style={{ color: c.text }}>
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
  );
}

