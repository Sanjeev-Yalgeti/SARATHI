import { AlertTriangle } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Dropdown from "../components/Dropdown";

const SIDEBAR_ITEMS = [
  "All Alerts",
  "High Priority",
  "Landslides",
  "Floods",
  "Road Blocks",
  "Weather Alerts",
];

const ALERTS = [
  { risk: "High Risk", color: "#dc2626", bg: "#fee2e2" },
  { risk: "Medium Risk", color: "#2563eb", bg: "#dbeafe" },
  { risk: "Low Risk", color: "#16a34a", bg: "#dcfce7" },
];

export default function AlertsPage({ c, sub, setSub }) {
  return (
    <div className="flex">
      <Sidebar c={c} title="Alerts" items={SIDEBAR_ITEMS} active={sub} setActive={setSub} />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-3xl font-extrabold" style={{ color: c.text }}>
            All Alerts
          </h1>
          <div className="flex gap-3">
            <Dropdown c={c} label="All States" />
            <Dropdown c={c} label="High to Low" />
          </div>
        </div>
        <p className="mb-5" style={{ color: c.textMuted }}>
          Real-time alerts and warnings from across NER
        </p>

        <div className="flex flex-col gap-4">
          {ALERTS.map((a, idx) => (
            <div
              key={idx}
              className="flex items-center gap-4 rounded-xl p-5"
              style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}
            >
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                style={{ background: a.bg }}
              >
                <AlertTriangle size={18} style={{ color: a.color }} />
              </div>
              <div className="flex-1">
                <div className="font-bold" style={{ color: c.text }}>
                  Landslide Detected
                </div>
                <div className="text-sm" style={{ color: c.textMuted }}>
                  NH-306, Near Jorhat, Assam
                </div>
                <div className="text-sm font-semibold" style={{ color: c.textMuted }}>
                  {a.risk}
                </div>
              </div>
              <div className="text-sm" style={{ color: c.textMuted }}>
                5m ago
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
