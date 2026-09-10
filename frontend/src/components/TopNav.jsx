import { Moon, Sun, LogOut, Shield, Truck } from "lucide-react";
import { NAV_ITEMS } from "../constants";
const LightLogo = '/lightLogo.png';
const DarkLogo = '/darkLogo.png';

// Driver role only sees Live Map, Alerts, and Reports
const DRIVER_NAV_ITEMS = ["Live Map", "Alerts", "Reports"];

export default function TopNav({
    c,
    active,
    setActive,
    theme,
    setTheme,
    isLoggedIn = false,
    userRole = "ADMIN",
    currentUser = null,
    onLogout
}) {
    const isDriver = userRole === "DRIVER" || userRole === "restricted";
    const currentNavItems = isDriver ? DRIVER_NAV_ITEMS : NAV_ITEMS;

    return (
        <div className="w-full flex items-center justify-between px-6 py-3 bg-transparent pointer-events-auto">
            <div
                className="flex justify-center items-center cursor-pointer"
                onClick={() => {
                    if (isDriver) {
                        setActive("Live Map");
                    } else {
                        setActive("Home");
                    }
                }}
            >
                <img src={theme === 'light' ? LightLogo : DarkLogo} className="h-10 md:h-26 w-auto px-2" alt="SARATHI Logo" />
            </div>

            {isLoggedIn && (
                <nav className="hidden md:flex items-center gap-8 lg:gap-12 text-base lg:text-lg font-medium" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {currentNavItems.map((item) => (
                        <button
                            key={item}
                            onClick={() => setActive(item)}
                            className="pb-1 border-b-2 transition-colors cursor-pointer"
                            style={{
                                color: active === item ? c.text : c.textMuted,
                                borderColor: active === item ? (c.green || "#0a8754") : "transparent",
                                fontWeight: active === item ? 700 : 500,
                            }}
                        >
                            {item}
                        </button>
                    ))}
                </nav>
            )}

            <div className="flex items-center gap-3">
                {isLoggedIn && (
                    <div className="flex items-center gap-2">
                        {/* User profile / role badge */}
                        <div
                            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{
                                background: isDriver ? (theme === 'light' ? '#dbeafe' : '#1e3a8a33') : (theme === 'light' ? '#dcfce7' : '#064e3b33'),
                                color: isDriver ? '#2563eb' : '#16a34a',
                                border: `1px solid ${isDriver ? '#93c5fd' : '#86efac'}`
                            }}
                        >
                            {isDriver ? <Truck size={13} /> : <Shield size={13} />}
                            <span>{currentUser?.name || currentUser?.id || (isDriver ? "Driver" : "Admin")}</span>
                            <span className="opacity-75 font-mono text-[10px]">[{userRole}]</span>
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={onLogout}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold border transition-all duration-200 hover:opacity-90 cursor-pointer shadow-sm"
                            style={{
                                background: theme === "light" ? "#fee2e2" : "#3b1219",
                                borderColor: theme === "light" ? "#fca5a5" : "#7f1d1d",
                                color: theme === "light" ? "#dc2626" : "#f87171"
                            }}
                            title="Log out of current session"
                        >
                            <LogOut size={16} />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                )}

                <button
                    onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                    className="w-10 h-10 rounded-full flex items-center justify-center border shadow-md hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer backdrop-blur-md"
                    style={{
                        background: theme === "light" ? "#0f2a4a" : "#1e2b40",
                        borderColor: theme === "light" ? "#1e3a5f" : "#334155",
                        color: theme === "light" ? "#fbbf24" : "#facc15",
                        boxShadow: theme === "light" ? "0 4px 12px rgba(15, 42, 74, 0.35)" : "0 4px 12px rgba(0, 0, 0, 0.5)"
                    }}
                    aria-label="Toggle theme"
                >
                    {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
                </button>
            </div>
        </div>
    );
}
