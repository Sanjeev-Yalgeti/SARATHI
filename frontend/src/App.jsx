import { useState } from "react";
import { palette } from "./constants";
import TopNav from "./components/TopNav";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState("admin"); // "admin" | "restricted"

  const c = palette[theme];

  // Restricted users can only access Live Map, Reports, and Alerts
  const restrictedAllowedPages = ["Live Map", "Reports", "Alerts"];
  const effectiveActive = (isLoggedIn && userRole === "restricted" && !restrictedAllowedPages.includes(active))
    ? "Live Map"
    : active;

  return (
    <div style={{ background: c.pageBg, minHeight: "100vh", minwidth: "100vw" }} className="font-sans">
      {/* Fixed overlay nav — sits above every page */}
      {effectiveActive !== "Login" && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-transparent pointer-events-none">
          <TopNav
            c={c}
            active={effectiveActive}
            setActive={setActive}
            theme={theme}
            setTheme={setTheme}
            isLoggedIn={isLoggedIn}
            userRole={userRole}
            setIsLoggedIn={setIsLoggedIn}
            setUserRole={setUserRole}
          />
        </div>
      )}

      {/* pt-18 offsets the fixed nav; pt-10 adds breathing room at the top of every page */}
      <div className={effectiveActive === "Login" ? "" : (isLoggedIn ? "pt-18" : " ")}>
        {effectiveActive === "Login" && (
          <LoginPage
            c={c}
            setActive={setActive}
            setIsLoggedIn={setIsLoggedIn}
            setUserRole={setUserRole}
          />
        )}
        {effectiveActive === "Home" && (
          <HomePage c={c} onGetStarted={() => setActive("Login")} setActive={setActive} />
        )}

        {effectiveActive === "Live Map" && (
          <LiveMapPage c={c} />
        )}

        {effectiveActive === "Trips" && (
          <TripsPage c={c} />
        )}

        {effectiveActive === "Alerts" && (
          <AlertsPage c={c} />
        )}

        {effectiveActive === "Reports" && (
          <ReportsPage c={c} />
        )}

        {effectiveActive === "Analytics" && (
          <AnalyticsPage c={c} />
        )}

        {effectiveActive === "Simulation" && (
          <SimulationPage c={c} />
        )}

        {effectiveActive === "Resources" && (
          <ResourcesPage c={c} />
        )}

      </div>
    </div>
  );
}
