import { Mountain, Database, TrendingUp, Route, Bell as BellIcon, LayoutDashboard } from "lucide-react";
import StatCard from "../components/StatCard";

const STATS = [
  { value: "8", label: "NER States" },
  { value: "24/7", label: "Real-Time Monitoring" },
  { value: "1000+", label: "Field Reports/Day" },
  { value: "99.9%", label: "System Uptime" },
];

const STEPS = [
  {
    icon: Database,
    title: "Data Collection",
    desc: "Real-time data from GPS, weather, road sensors, & field inputs.",
  },
  {
    icon: TrendingUp,
    title: "AI Analysis",
    desc: "ML models detect risks, disruptions, and optimize routes.",
  },
  {
    icon: Route,
    title: "Route Optimization",
    desc: "AI suggests alternate safe & efficient routes.",
  },
  {
    icon: BellIcon,
    title: "Alerts & Notifications",
    desc: "Instant alerts for blocked roads, high-risk zones, etc.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    desc: "Live visualization of logistics and accessibility status.",
  },
];

const STATES = ["Arunachal Pradesh", "Assam", "Manipur", "Meghalaya"];

const FOOTER_COLS = [
  {
    title: "Quick Links",
    links: ["Home", "Platform", "Features", "Simulation", "Dashboard", "About Us"],
  },
  {
    title: "Features",
    links: [
      "AI Route Optimization",
      "Real-Time Alerts",
      "GPS Tracking",
      "Weather Intelligence",
      "Field Reports",
    ],
  },
  {
    title: "Resources",
    links: ["Help Center", "API Documentation", "Privacy Policy", "Terms of Service"],
  },
];

export default function AboutPage({ c }) {
  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-2" style={{ color: c.text }}>
        About SARATHI
      </h1>
      <p className="mb-8 max-w-3xl" style={{ color: c.textMuted }}>
        SARATHI is an AI-powered logistics intelligence platform designed specifically for the North
        Eastern Region of India. It integrates real-time data, GIS, weather, and machine learning to
        enhance accessibility and supply chain reliability.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-14">
        {STATS.map((s) => (
          <StatCard key={s.label} c={c} value={s.value} label={s.label} valueColor={c.green} />
        ))}
      </div>

      {/* How it works */}
      <h2 className="text-2xl font-extrabold text-center mb-8" style={{ color: c.text }}>
        How SARATHI works
      </h2>
      <div className="grid md:grid-cols-5 gap-4 mb-14">
        {STEPS.map(({ icon: Icon, title, desc }, idx) => (
          <div key={title} className="flex items-center gap-3">
            <div
              className="rounded-xl p-5 flex-1 text-center flex flex-col items-center gap-3"
              style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}
            >
              <Icon size={26} style={{ color: c.orange }} />
              <div className="font-bold" style={{ color: c.text }}>
                {title}
              </div>
              <div className="text-xs" style={{ color: c.textMuted }}>
                {desc}
              </div>
            </div>
            {idx < STEPS.length - 1 && (
              <span className="hidden md:block text-2xl" style={{ color: c.textMuted }}>
                &rarr;
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Supported NER States */}
      <h2 className="text-2xl font-extrabold text-center mb-6" style={{ color: c.text }}>
        Supported NER States
      </h2>
      {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
        {STATES.map((s) => (
          
        ))}
      </div> */}

      {/* Footer */}
      <div
        className="rounded-2xl p-10 grid md:grid-cols-4 gap-8"
        style={{ background: c.footerBg }}
      >
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: c.green }}
            >
              <Mountain size={18} color="#fff" />
            </div>
            <span className="text-white font-extrabold text-lg">SARATHI</span>
          </div>
        </div>

        {FOOTER_COLS.map((col) => (
          <div key={col.title}>
            <div className="text-white font-bold mb-3">{col.title}</div>
            <div className="flex flex-col gap-2">
              {col.links.map((l) => (
                <span key={l} className="text-sm" style={{ color: c.footerText }}>
                  {l}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
