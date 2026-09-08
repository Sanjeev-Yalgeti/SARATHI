import Sidebar from "../components/Sidebar";
import Dropdown from "../components/Dropdown";

const SIDEBAR_ITEMS = [
  "Field Reports",
  "My Submissions",
  "Reports Analytics",
  "Download Reports",
];

export default function ReportsPage({ c, sub, setSub }) {
  return (
    <div className="flex">
      <Sidebar c={c} title="Reports" items={SIDEBAR_ITEMS} active={sub} setActive={setSub} />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h1 className="text-3xl font-extrabold" style={{ color: c.text }}>
            Field Reports
          </h1>
          <div className="flex gap-3">
            <Dropdown c={c} label="All States" />
            <Dropdown c={c} label="All Types" />
            <Dropdown c={c} label="Today" />
          </div>
        </div>
        <p className="mb-5" style={{ color: c.textMuted }}>
          View all field reports submitted by teams and users
        </p>

        <div className="grid md:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden"
              style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}
            >

              <div className="p-4">
                <div className="font-bold" style={{ color: c.text }}>
                  Landslide
                </div>
                <div className="text-sm" style={{ color: c.textMuted }}>
                  NH-306, Near Jorhat, Assam
                </div>
                <div className="text-sm font-bold mt-2" style={{ color: "#dc2626" }}>
                  High Risk
                </div>
                <div className="text-sm" style={{ color: c.textMuted }}>
                  By: Field Team 01 &middot; 10m ago
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
