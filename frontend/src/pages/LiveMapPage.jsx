import StatCard from "../components/StatCard";
import LiveMap from "../components/LiveMap";

export default function LiveMapPage({ c, userRole = "ADMIN", currentUser = null }) {
  const insights = [
    { value: 8, label: "Total Active Alerts", note: "High Priority: 7", noteColor: "#dc2626" },
    { value: 5, label: "Roads Affected", note: "NH-715, NH-15, NH-37", noteColor: c.textMuted },
    { value: 3, label: "Trucks En Route", note: "1 Blocked, 2 Moving", noteColor: "#ea580c" },
    { value: 4, label: "Weather Warnings", note: "Active Monsoon Alert", noteColor: "#16a34a" },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold mb-1" style={{ color: c.text }}>
          Live Logistics Map
        </h1>
        <p className="text-sm sm:text-base" style={{ color: c.textMuted }}>
          Real-time GIS overview of fleet GPS tracking, disaster incidents, and risk-aware corridor guidance across the North-Eastern Region.
        </p>
      </div>

      {/* Interactive Map Component */}
      <div className="w-full">
        <LiveMap
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
