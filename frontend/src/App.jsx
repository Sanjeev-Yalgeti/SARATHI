import { useState, useEffect } from "react";
import { palette } from "./constants";
import TopNav from "./components/TopNav";
import GoldenPathGuide from "./components/GoldenPathGuide";
import AlertToasts from "./components/AlertToasts";
import useAlertsSocket from "./hooks/useAlertsSocket";
import { getStoredToken, getStoredUser, getProfile, logout } from "./api/auth";

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
  const [userRole, setUserRole] = useState(null); // "ADMIN" | "DRIVER"
  const [currentUser, setCurrentUser] = useState(null);

  // Live alert popups (Socket.io) for every logged-in role.
  const { toasts, dismiss } = useAlertsSocket(isLoggedIn, currentUser?.id);

  // Keep document element dark class synchronized with theme state
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Session Hydration on page load / refresh (per FRONTEND_HANDOFF.md §3)
  useEffect(() => {
    let isMounted = true;
    async function hydrateSession() {
      const token = getStoredToken();
      const cachedUser = getStoredUser();

      if (!token) {
        return;
      }

      // Optimistically set from cached localStorage first for instantaneous UI render
      if (cachedUser) {
        setIsLoggedIn(true);
        setUserRole(cachedUser.role);
        setCurrentUser(cachedUser);
      }

      try {
        // Hydrate and verify with server GET /api/auth/me
        const user = await getProfile();
        if (isMounted && user) {
          setIsLoggedIn(true);
          setUserRole(user.role);
          setCurrentUser(user);
        }
      } catch {
        // If token is invalid or expired, clear session
        if (isMounted) {
          logout();
          setIsLoggedIn(false);
          setUserRole(null);
          setCurrentUser(null);
        }
      }
    }

    hydrateSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
    setUserRole(null);
    setCurrentUser(null);
    setActive("Home");
  };

  const c = palette[theme];

  // Drivers can only access Live Map, Alerts, and Reports
  const isDriver = userRole === "DRIVER" || userRole === "restricted";
  const driverAllowedPages = ["Live Map", "Alerts", "Reports"];

  const effectiveActive = (isLoggedIn && isDriver && !driverAllowedPages.includes(active))
    ? "Live Map"
    : active;

  return (
    <div style={{ background: c.pageBg, minHeight: "100vh", minWidth: "100vw" }} className="font-sans">
      {/* Real-time alert popups — admin + driver dashboards */}
      {isLoggedIn && <AlertToasts toasts={toasts} onDismiss={dismiss} />}
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
            userRole={userRole || "ADMIN"}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        </div>
      )}

      {/* pt-18 offsets the fixed nav; pt-10 adds breathing room at the top of every page */}
      <div className={effectiveActive === "Login" ? "" : (isLoggedIn ? "pt-18" : " ")}>
        {effectiveActive === "Login" && (
          <LoginPage
            setActive={setActive}
            setIsLoggedIn={setIsLoggedIn}
            setUserRole={setUserRole}
            setCurrentUser={setCurrentUser}
          />
        )}
        {effectiveActive === "Home" && (
          <HomePage
            c={c}
            onGetStarted={() => setActive(isLoggedIn ? (isDriver ? "Live Map" : "Trips") : "Login")}
            setActive={setActive}
            isLoggedIn={isLoggedIn}
            userRole={userRole}
          />
        )}

        {effectiveActive === "Live Map" && (
          <LiveMapPage c={c} userRole={userRole} currentUser={currentUser} />
        )}

        {effectiveActive === "Trips" && (
          <TripsPage c={c} userRole={userRole} currentUser={currentUser} />
        )}

        {effectiveActive === "Alerts" && (
          <AlertsPage c={c} userRole={userRole} currentUser={currentUser} />
        )}

        {effectiveActive === "Reports" && (
          <ReportsPage c={c} userRole={userRole} currentUser={currentUser} />
        )}

        {effectiveActive === "Analytics" && (
          <AnalyticsPage c={c} userRole={userRole} currentUser={currentUser} setActive={setActive} />
        )}

        {effectiveActive === "Simulation" && (
          <SimulationPage c={c} userRole={userRole} currentUser={currentUser} setActive={setActive} />
        )}

        {effectiveActive === "Resources" && (
          <ResourcesPage c={c} />
        )}

      </div>

      {/* Interactive Golden Path Demo Guide Widget */}
      <GoldenPathGuide
        c={c}
        setActive={setActive}
        setIsLoggedIn={setIsLoggedIn}
        setUserRole={setUserRole}
        setCurrentUser={setCurrentUser}
      />
    </div>
  );
}
