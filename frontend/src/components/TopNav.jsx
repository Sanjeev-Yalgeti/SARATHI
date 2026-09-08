import { Moon, Sun, User } from "lucide-react";
import { NAV_ITEMS } from "../constants";

export default function TopNav({ c, active, setActive, theme, setTheme }) {
    return (

        <div
            className="w-full h-[15%] flex items-center justify-between px-6 py-3 bg-transparent"
        >
            <div className="flex justify-center items-center ">
                <img src='../../public/logo.png' className="h-[75%] w-[75%] px-5"></img>
            </div>

            <nav className="hidden md:flex items-center gap-6 text-[15px] font-medium">
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item}
                        onClick={() => setActive(item)}
                        className="pb-1 border-b-2 transition-colors"
                        style={{
                            color: active === item ? c.text : c.textMuted,
                            borderColor: active === item ? c.text : "transparent",
                            fontWeight: active === item ? 700 : 500,
                        }}
                    >
                        {item}
                    </button>
                ))}
            </nav>

            <div className="flex items-center gap-3">
                <button
                    onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                    className="w-9 h-9 rounded-full flex items-center justify-center border"
                    style={{ borderColor: c.cardBorder, color: c.text }}
                    aria-label="Toggle theme"
                >
                    {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
                </button>
                <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: c.text }}
                >
                    <User size={18} color={c.pageBg} />
                </div>
            </div>
        </div >
    );
}
