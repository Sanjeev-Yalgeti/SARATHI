import { useState } from "react";
import {
  Play,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Shield,
  Radio,
} from "lucide-react";
import { login } from "../api/auth";
import apiClient from "../api/client";

const DEMO_STEPS = [
  {
    step: 1,
    title: "Admin Authentication & Full Command Center",
    role: "ADMIN",
    account: "admin / sarathi@123",
    page: "Home",
    badge: "STAGE 1",
    script:
      "Log in as Administrator. The top navigation reveals all 8 operational tabs (Live Map, Trips, Alerts, Reports, Analytics, Simulation, Resources). The platform operates on real database accounts and ASDMA records.",
    buttonLabel: "Log In as Admin & Start Demo",
    action: async ({ setActive, setIsLoggedIn, setUserRole, setCurrentUser }) => {
      const data = await login("admin", "sarathi@123");
      setIsLoggedIn(true);
      setUserRole("ADMIN");
      setCurrentUser(data.user);
      setActive("Live Map");
    },
  },
  {
    step: 2,
    title: "Peak Flood Corridor & Automated Rerouting (28-Jul-2026)",
    role: "ADMIN",
    account: "admin",
    page: "Live Map",
    badge: "STAGE 2",
    script:
      "Switch clock to 2026-07-28 (Peak Flood). 8 real ASDMA incidents load on the map. Notice the Kaziranga breach hard-block (15km radius) halting relief trucks, and the RED banner suggesting the northern Tezpur bypass.",
    buttonLabel: "Trigger Peak Flood & Open Live Map",
    action: async ({ setActive }) => {
      try {
        await apiClient.post("/api/simulation/date", { date: "2026-07-28" });
      } catch {
        // Continue navigation
      }
      setActive("Live Map");
    },
  },
  {
    step: 3,
    title: "Fleet Dispatch & Real-Time Telemetry Tracking",
    role: "ADMIN",
    account: "admin",
    page: "Trips",
    badge: "STAGE 3",
    script:
      "Inspect the fleet dispatch board. Truck AS-01-FOOD-04 is en route from Guwahati to Golaghat. Review live 2.5s telemetry sync, speed metrics, and the option to assign new relief trips.",
    buttonLabel: "Inspect Fleet Trips Board",
    action: async ({ setActive }) => {
      setActive("Trips");
    },
  },
  {
    step: 4,
    title: "Driver Scoped View (AS-01-FOOD-04)",
    role: "DRIVER",
    account: "AS-01-FOOD-04 / driver123",
    page: "Live Map",
    badge: "STAGE 4",
    script:
      "Switch to the driver's role. Navigation automatically restricts to 3 tabs only (Live Map, Alerts, Reports). The driver sees only their own vehicle telemetry and can file verified reports within 1km of an incident.",
    buttonLabel: "Switch to Driver Account (AS-01)",
    action: async ({ setActive, setIsLoggedIn, setUserRole, setCurrentUser }) => {
      const data = await login("AS-01-FOOD-04", "driver123");
      setIsLoggedIn(true);
      setUserRole("DRIVER");
      setCurrentUser(data.user);
      setActive("Live Map");
    },
  },
  {
    step: 5,
    title: "Simulation Engine & What-If Stress Testing",
    role: "ADMIN",
    account: "admin",
    page: "Simulation",
    badge: "STAGE 5",
    script:
      "Switch back to Admin and launch the Simulation Lab. Demonstrate the 2.0s tick loop, switch scenario dates (2026-07-19 Onset vs 2026-07-28 Peak), adjust What-If rainfall sliders, and teleport trucks via Mock GPS.",
    buttonLabel: "Launch Simulation Lab",
    action: async ({ setActive, setIsLoggedIn, setUserRole, setCurrentUser }) => {
      const data = await login("admin", "sarathi@123");
      setIsLoggedIn(true);
      setUserRole("ADMIN");
      setCurrentUser(data.user);
      setActive("Simulation");
    },
  },
  {
    step: 6,
    title: "Disaster Analytics & Official ASDMA Bulletin PDF",
    role: "ADMIN",
    account: "admin",
    page: "Analytics",
    badge: "STAGE 6",
    script:
      "Review the Analytics dashboard. Run corridor risk simulations for Guwahati to Golaghat, inspect landslide probabilities, check live weather, and download the official ASDMA daily flood bulletin PDF.",
    buttonLabel: "Open Analytics & Download Bulletin",
    action: async ({ setActive }) => {
      setActive("Analytics");
    },
  },
];

export default function GoldenPathGuide({
  setActive,
  setIsLoggedIn,
  setUserRole,
  setCurrentUser,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [running, setRunning] = useState(false);

  const stepData = DEMO_STEPS[currentStepIndex];

  const handleRunStep = async () => {
    setRunning(true);
    try {
      if (stepData.action) {
        await stepData.action({
          setActive,
          setIsLoggedIn,
          setUserRole,
          setCurrentUser,
        });
      }
    } finally {
      setRunning(false);
    }
  };

  const handleNext = () => {
    if (currentStepIndex < DEMO_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  return (
    <>
      {/* Floating Demo Trigger Button (Bottom Left) */}
      <div className="fixed bottom-5 left-5 z-50 pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-xs shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer border backdrop-blur-md"
          style={{
            background: isOpen ? "#0f2a4a" : "#0a8754",
            borderColor: isOpen ? "#1e3a5f" : "#22c55e",
            color: "#ffffff",
            boxShadow: "0 8px 24px rgba(10, 135, 84, 0.4)",
          }}
        >
          <Sparkles size={14} className="text-amber-300 animate-spin" />
          <span>{isOpen ? "Close Golden Path" : "Golden Path Demo (3-Min)"}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono">
            {currentStepIndex + 1}/{DEMO_STEPS.length}
          </span>
        </button>
      </div>

      {/* Expanded Interactive Tour Drawer / Modal */}
      {isOpen && (
        <div
          className="fixed bottom-18 left-5 z-50 w-[92vw] max-w-lg rounded-3xl border shadow-2xl p-5 backdrop-blur-xl animate-fade-in pointer-events-auto font-sans"
          style={{
            background: "rgba(15, 26, 46, 0.96)",
            borderColor: "rgba(56, 189, 248, 0.3)",
            color: "#ffffff",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-700/60 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {stepData.badge}
              </span>
              <span className="text-xs font-bold text-gray-300">
                SARATHI Teacher / Evaluator Script
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Title and Role */}
          <div className="space-y-1 mb-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">
                {stepData.title}
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1 font-semibold text-emerald-400">
                <Shield size={12} /> {stepData.role}
              </span>
              <span>•</span>
              <span className="font-mono text-[11px] text-gray-300">
                Target Page: <strong>{stepData.page}</strong>
              </span>
            </div>
          </div>

          {/* Presenter Speech Narrative Note */}
          <div className="p-3.5 rounded-2xl bg-gray-900/80 border border-gray-700/50 mb-4 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
              <Radio size={11} className="animate-pulse" />
              <span>Presenter Script &amp; What Judges See</span>
            </div>
            <p className="text-xs leading-relaxed text-gray-300">
              {stepData.script}
            </p>
          </div>

          {/* 1-Click Action Button */}
          <div className="space-y-3">
            <button
              type="button"
              disabled={running}
              onClick={handleRunStep}
              className="w-full py-3 px-4 rounded-2xl font-extrabold text-xs sm:text-sm text-white shadow-lg transition-all hover:opacity-90 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #0a8754 0%, #16a34a 100%)",
                boxShadow: "0 4px 16px rgba(10, 135, 84, 0.4)",
              }}
            >
              <Play size={15} fill="currentColor" />
              <span>{running ? "Executing Step..." : stepData.buttonLabel}</span>
            </button>

            {/* Stepper Navigation */}
            <div className="flex items-center justify-between pt-1 border-t border-gray-800 text-xs">
              <button
                type="button"
                disabled={currentStepIndex === 0}
                onClick={handlePrev}
                className="px-3 py-1.5 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-1.5">
                {DEMO_STEPS.map((s, idx) => (
                  <button
                    key={s.step}
                    onClick={() => setCurrentStepIndex(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                      idx === currentStepIndex
                        ? "w-6 bg-emerald-400"
                        : "bg-gray-700 hover:bg-gray-500"
                    }`}
                    title={`Step ${s.step}: ${s.title}`}
                  />
                ))}
              </div>

              <button
                type="button"
                disabled={currentStepIndex === DEMO_STEPS.length - 1}
                onClick={handleNext}
                className="px-3 py-1.5 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
