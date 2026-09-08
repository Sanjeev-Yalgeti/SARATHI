import { Clock, MapPin, CloudRain, File } from "lucide-react";

export default function HomePage({ c }) {
    const items = [
        { icon: Clock, label: "Real-time monitoring" },
        { icon: MapPin, label: "AI Route Prediction" },
        { icon: CloudRain, label: "Weather & Disruption Alerts" },
        { icon: MapPin, label: "GPS Vehicle Tracking" },
        { icon: File, label: "Field Reports Offline Support" },
    ];

    return (
        // Full-viewport background that sits behind the fixed nav
        // bg-[length:100%_100%] forces the image to stretch across the entire screen
        <div
            className="w-full"
            style={{
                background: `linear-gradient(105deg, ${c.pageBg} 0%, ${c.pageBg} 30%, transparent 65%), url('/bg.jpeg') no-repeat center center`,
                backgroundSize: "100% 100%",
                minHeight: "calc(100vh - 72px)",
            }}
        >
            {/* Content container with padding */}
            <div className="py-10 flex flex-col justify-center text-left w-[50%]">
                <h1 className="text-5xl font-extrabold leading-tight mb-8" style={{ color: c.text }}>
                    AI-Based Smart Logistics &amp; Accessibility Intelligence Platform for North Eastern Region
                    (NER)
                </h1>
                {/* list of features */}
                <div className="flex flex-col gap-5">
                    {items.map(({ icon: Icon, label }) => (
                        <div key={label} className="flex items-center gap-4">
                            <Icon size={22} style={{ color: c.text }} />
                            <span className="font-semibold" style={{ color: c.text }}>
                                {label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
