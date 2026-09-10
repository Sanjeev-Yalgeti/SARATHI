import { Clock, MapPin, CloudRain, FileText, Database, Brain, Navigation2, Bell, LayoutDashboard, ArrowRight, ChevronDown } from "lucide-react";

export default function HomePage({ c, onGetStarted, setActive }) {
    /* ── Hero feature list ── */
    const heroItems = [
        { icon: Clock, label: "Real-time monitoring" },
        { icon: MapPin, label: "AI Route Prediction" },
        { icon: CloudRain, label: "Weather & Disruption Alerts" },
        { icon: MapPin, label: "GPS Vehicle Tracking" },
        { icon: FileText, label: "Field Reports Offline Support" },
    ];

    /* ── Stats ── */
    const stats = [
        { value: "8", label: "NER States" },
        { value: "24/7", label: "Real-Time Monitoring" },
        { value: "1000+", label: "Field Reports / Day" },
        { value: "99.9%", label: "System Uptime" },
    ];

    /* ── How it works ── */
    const steps = [
        { icon: Database, title: "Data Collection", desc: "Real-time data from GPS, weather, road sensors, & field inputs." },
        { icon: Brain, title: "AI Analysis", desc: "ML models detect risks, disruptions, and optimize routes." },
        { icon: Navigation2, title: "Route Optimization", desc: "AI suggests alternate safe & efficient routes." },
        { icon: Bell, title: "Alerts & Notifications", desc: "Instant alerts for blocked roads, high-risk zones, etc." },
        { icon: LayoutDashboard, title: "Dashboard", desc: "Live visualization of logistics and accessibility status." },
    ];



    /* ── Footer columns ── */
    const footerCols = [
        { heading: "Quick Links", links: ["Home", "Platform", "Features", "Simulation", "Dashboard", "About Us"] },
        { heading: "Features", links: ["AI Route Optimization", "Real-Time Alerts", "GPS Tracking", "Weather Intelligence", "Field Reports"] },
        { heading: "Resources", links: ["Help Center", "API Documentation", "Privacy Policy", "Terms of Service"] },
    ];

    return (
        <div style={{ background: c.pageBg }}>

            {/* ═══ HERO ═══ */}
            <div
                className="relative overflow-hidden"
                style={{
                    width: "100%",
                    height: "calc(100vh )",
                    backgroundImage: `linear-gradient(105deg, ${c.pageBg} 0%, ${c.pageBg} 30%, transparent 65%), url('/bg.jpeg')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                }}
            >
                <div className="h-full flex flex-col justify-center w-[52%] px-16">
                    <h1 className="text-5xl font-extrabold leading-tight mb-10" style={{ color: c.text }}>
                        AI-Based Smart Logistics &amp; Accessibility Intelligence
                        Platform for North Eastern Region (NER)
                    </h1>
                    <div className="flex flex-col gap-5">
                        {heroItems.map(({ icon: Icon, label }) => (
                            <div key={label} className="flex items-center gap-4">
                                <Icon size={28} style={{ color: c.green }} />
                                <span className="text-xl font-semibold" style={{ color: c.text }}>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Get Started Button & Scroll hint */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-20">
                    <button
                        onClick={() => {
                            if (onGetStarted) onGetStarted();
                            else if (setActive) setActive("Login");
                        }}
                        className="px-8 py-3.5 rounded-full font-bold text-base shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2.5 cursor-pointer"
                        style={{
                            background: "#ff6200",
                            color: "#ffffff",
                            boxShadow: `0 8px 24px ${c.green}50`
                        }}
                    >
                        <span>Get Started</span>
                        <ArrowRight size={20} />
                    </button>

                    <div className="flex flex-col items-center gap-1 animate-bounce">
                        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: c.textMuted }}>Scroll</span>
                        <ChevronDown size={18} style={{ color: c.textMuted }} />
                    </div>
                </div>
            </div>

            {/* ═══ ABOUT ═══ */}
            <section className="py-20 px-16" style={{ background: c.pageBg }}>
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-4xl font-extrabold mb-4" style={{ color: c.text }}>
                        About <span style={{ color: c.green }}>SARATHI</span>
                    </h2>
                    <p className="text-lg mb-12 max-w-2xl leading-relaxed" style={{ color: c.textMuted }}>
                        SARATHI is an AI-powered logistics intelligence platform designed specifically for the
                        North Eastern Region of India. It integrates real-time data, GIS, weather, and machine
                        learning to enhance accessibility and supply chain reliability.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {stats.map(({ value, label }) => (
                            <div
                                key={label}
                                className="rounded-2xl p-6 text-center shadow-sm"
                                style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}
                            >
                                <div className="text-4xl font-black mb-2" style={{ color: c.green }}>{value}</div>
                                <div className="text-sm font-semibold" style={{ color: c.textMuted }}>{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ HOW IT WORKS ═══ */}
            <section className="py-20 px-16" style={{ background: c.cardBg }}>
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-4xl font-extrabold text-center mb-14" style={{ color: c.text }}>
                        How <span style={{ color: c.green }}>SARATHI</span> Works
                    </h2>
                    <div className="flex flex-col md:flex-row items-center gap-0">
                        {steps.map(({ icon: Icon, title, desc }, i) => (
                            <>
                                <div key={title} className="flex-1 self-stretch">
                                    <div
                                        className="rounded-2xl p-6 shadow-md w-full h-full"
                                        style={{ background: c.pageBg, border: `1px solid ${c.cardBorder}`, minHeight: "210px" }}
                                    >
                                        <div
                                            className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                                            style={{ background: `${c.green}22` }}
                                        >
                                            <Icon size={28} style={{ color: c.green }} />
                                        </div>
                                        <h3 className="font-bold text-base mb-2" style={{ color: c.text }}>{title}</h3>
                                        <p className="text-sm leading-relaxed" style={{ color: c.textMuted }}>{desc}</p>
                                    </div>
                                </div>
                                {i < steps.length - 1 && (
                                    <div className="flex-shrink-0 flex items-center justify-center px-3 py-4 md:py-0">
                                        <ArrowRight size={22} style={{ color: c.textMuted }} />
                                    </div>
                                )}
                            </>
                        ))}
                    </div>
                </div>
            </section>



            {/* ═══ FOOTER ═══ */}
            <footer style={{ background: c.footerBg, color: c.footerText }}>
                <div className="max-w-6xl mx-auto px-16 py-16">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
                        {/* Brand */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <img
                                    src="/logo.png"
                                    alt="SARATHI"
                                    className="h-12 w-auto"
                                    onError={e => { e.target.style.display = "none"; }}
                                />
                                <span className="text-2xl font-black tracking-wide text-white">SARATHI</span>
                            </div>
                            <p className="text-sm leading-relaxed" style={{ color: c.footerText }}>
                                AI-Based Smart Logistics &amp; Accessibility Intelligence Platform for North Eastern Region.
                            </p>
                        </div>
                        {/* Link columns */}
                        {footerCols.map(({ heading, links }) => (
                            <div key={heading}>
                                <h4 className="font-bold text-base text-white mb-5">{heading}</h4>
                                <ul className="flex flex-col gap-3">
                                    {links.map(link => (
                                        <li key={link}>
                                            <span
                                                className="text-sm cursor-pointer transition-colors duration-150 hover:text-white"
                                                style={{ color: c.footerText }}
                                            >
                                                {link}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                    {/* Bottom bar */}
                    <div
                        className="mt-12 pt-6 text-sm text-center"
                        style={{ borderTop: `1px solid ${c.footerText}40`, color: c.footerText }}
                    >
                        © 2025 SARATHI. All rights reserved. Built for Smart India Hackathon.
                    </div>
                </div>
            </footer>
        </div>
    );
}
