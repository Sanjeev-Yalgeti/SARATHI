import { useState } from "react";
import Sidebar from "../components/Sidebar";
import PillButton from "../components/PillButton";

const SIDEBAR_ITEMS = ["My Trips", "All Trips", "Trip History", "Planned Trips"];

const TRIPS = [
  {
    id: "TRP-7845",
    from: "Guwahati, Assam",
    to: "Aizawl, Mizoram",
    dist: "248 km",
    eta: "6h 45m",
    status: "In Progress",
  },
  {
    id: "TRP-7845",
    from: "Guwahati, Assam",
    to: "Aizawl, Mizoram",
    dist: "248 km",
    eta: "6h 45m",
    status: "In Progress",
  },
];

export default function TripsPage({ c, sub, setSub }) {
  const [tab, setTab] = useState("ongoing");

  return (
    <div className="flex">
      <Sidebar c={c} title="Trips" items={SIDEBAR_ITEMS} active={sub} setActive={setSub} />
      <div className="flex-1">
        <h1 className="text-3xl font-extrabold mb-1" style={{ color: c.text }}>
          My Trips
        </h1>
        <p className="mb-5" style={{ color: c.textMuted }}>
          View and manage your ongoing and upcoming trips
        </p>

        {/* Tabs */}
        <div className="flex gap-8 border-b mb-5" style={{ borderColor: c.cardBorder }}>
          {["ongoing (2)", "upcoming (1)", "completed (2)"].map((t) => {
            const key = t.split(" ")[0];
            return (
              <button
                key={t}
                onClick={() => setTab(key)}
                className="pb-2 font-semibold"
                style={{
                  color: tab === key ? c.green : c.textMuted,
                  borderBottom: tab === key ? `2px solid ${c.green}` : "2px solid transparent",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        {/* Trip Cards */}
        <div className="flex flex-col gap-4">
          {TRIPS.map((t, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-xl p-5"
              style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}
            >
              <div>
                <div className="font-bold" style={{ color: c.text }}>
                  {t.id}
                </div>
                <div className="text-sm" style={{ color: c.textMuted }}>
                  {t.from}
                </div>
                <div className="text-sm" style={{ color: c.textMuted }}>
                  {t.to}
                </div>
                <div className="text-sm font-semibold mt-1" style={{ color: c.green }}>
                  {t.status}
                </div>
              </div>
              <div className="text-sm" style={{ color: c.textMuted }}>
                <div>Distance:</div>
                <div className="font-bold" style={{ color: c.text }}>
                  {t.dist}
                </div>
              </div>
              <div className="text-sm" style={{ color: c.textMuted }}>
                <div>ETA:</div>
                <div className="font-bold" style={{ color: c.text }}>
                  {t.eta}
                </div>
              </div>
              <PillButton c={c}>View Details</PillButton>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
