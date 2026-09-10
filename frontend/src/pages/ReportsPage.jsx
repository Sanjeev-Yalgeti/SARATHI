import { useState } from "react";
import Dropdown from "../components/Dropdown";

const NE_STATES = [
  "Arunachal Pradesh",
  "Assam",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Sikkim",
  "Tripura",
];

export default function ReportsPage({ c }) {
  const [selectedState, setSelectedState] = useState(null);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h1 className="text-3xl font-extrabold" style={{ color: c.text }}>
          Field Reports
        </h1>
        <div className="flex gap-3">
          <Dropdown
            c={c}
            label="All States"
            options={NE_STATES}
            value={selectedState}
            onChange={setSelectedState}
          />
          <Dropdown c={c} label="All Types" />
          <Dropdown c={c} label="Today" />
        </div>
      </div>
      <p className="mb-6" style={{ color: c.textMuted }}>
        View all field reports submitted by teams and users
      </p>

      <div className="grid md:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl overflow-hidden"
            style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}
          >
            <div className="p-5">
              <div className="font-bold text-lg" style={{ color: c.text }}>
                Landslide
              </div>
              <div className="text-sm mt-1" style={{ color: c.textMuted }}>
                NH-306, Near Jorhat, Assam
              </div>
              <div className="text-sm font-bold mt-3" style={{ color: "#dc2626" }}>
                High Risk
              </div>
              <div className="text-xs mt-1" style={{ color: c.textMuted }}>
                By: Field Team 01 &middot; 10m ago
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

