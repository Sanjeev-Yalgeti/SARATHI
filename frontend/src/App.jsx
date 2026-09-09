import { useState } from "react";
import { palette } from "./constants";
import TopNav from "./components/TopNav";

import HomePage from "./pages/HomePage";
import LiveMapPage from "./pages/LiveMapPage";
import TripsPage from "./pages/TripsPage";
import AlertsPage from "./pages/AlertsPage";
import ReportsPage from "./pages/ReportsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SimulationPage from "./pages/SimulationPage";
import ResourcesPage from "./pages/ResourcesPage";

export default function SarathiApp() {
  const [theme, setTheme] = useState("light");
  const [active, setActive] = useState("Home");

  // Sub-page states for each section
  const [liveMapSub, setLiveMapSub] = useState("Map Overview");
  const [tripsSub, setTripsSub] = useState("My Trips");
  const [alertsSub, setAlertsSub] = useState("All Alerts");
  const [reportsSub, setReportsSub] = useState("Field Reports");
  const [analyticsSub, setAnalyticsSub] = useState("Driver Simulation");
  const [simulationSub, setSimulationSub] = useState("Driver Simulation");
  const [resourcesSub, setResourcesSub] = useState("Guidelines");

  const c = palette[theme];

  return (
    <div style={{ background: c.pageBg, minHeight: "100vh", minwidth: "100vw" }} className="font-sans">
      {/* Fixed overlay nav — sits above every page */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-transparent h-[50%]">
        <TopNav
          c={c}
          active={active}
          setActive={setActive}
          theme={theme}
          setTheme={setTheme}
        />
      </div>

      {/* pt-18 offsets the fixed nav; pt-10 adds breathing room at the top of every page */}
      <div className="pt-18 pt-10">
        {active === "Home" && <HomePage c={c} />}

        {active === "Live Map" && (
          <LiveMapPage c={c} sub={liveMapSub} setSub={setLiveMapSub} />
        )}

        {active === "Trips" && (
          <TripsPage c={c} sub={tripsSub} setSub={setTripsSub} />
        )}

        {active === "Alerts" && (
          <AlertsPage c={c} sub={alertsSub} setSub={setAlertsSub} />
        )}

        {active === "Reports" && (
          <ReportsPage c={c} sub={reportsSub} setSub={setReportsSub} />
        )}

        {active === "Analytics" && (
          <AnalyticsPage c={c} sub={analyticsSub} setSub={setAnalyticsSub} />
        )}

        {active === "Simulation" && (
          <SimulationPage c={c} sub={simulationSub} setSub={setSimulationSub} />
        )}

        {active === "Resources" && (
          <ResourcesPage c={c} sub={resourcesSub} setSub={setResourcesSub} />
        )}

      </div>
    </div>
  );
}
