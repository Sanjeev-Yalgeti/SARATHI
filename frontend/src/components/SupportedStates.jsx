import { useState } from "react";

const NER_STATES = [
  {
    name: "Arunachal Pradesh",
    img: "/arunachal-pradesh-map-india-vector-59890821 1.png",
    code: "AR",
    capital: "Itanagar",
  },
  {
    name: "Assam",
    img: "/images 2.png",
    code: "AS",
    capital: "Dispur",
  },
  {
    name: "Manipur",
    img: "/images 3.png",
    code: "MN",
    capital: "Imphal",
  },
  {
    name: "Meghalaya",
    img: "/images 4.png",
    code: "ML",
    capital: "Shillong",
  },
  {
    name: "Mizoram",
    img: "/images 5.png",
    code: "MZ",
    capital: "Aizawl",
  },
  {
    name: "Nagaland",
    img: "/images 6.png",
    code: "NL",
    capital: "Kohima",
  },
  {
    name: "Tripura",
    img: "/images 7.png",
    code: "TR",
    capital: "Agartala",
  },
  {
    name: "Sikkim",
    img: "/images 8.png",
    code: "SK",
    capital: "Gangtok",
  },
];

export default function SupportedStates({ c = {} }) {
  const [hoveredState, setHoveredState] = useState(null);

  return (
    <section
      className="py-14 px-6 sm:px-12 md:px-16 transition-colors duration-300"
      style={{ background: c.pageBg || "transparent" }}
    >
      <div className="max-w-[80%] mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10">
          <h2
            className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3"
            style={{ color: c.text || "inherit" }}
          >
            Supported <span style={{ color: c.green || "#0a8754" }}>NER States</span>
          </h2>
          <p
            className="text-sm sm:text-base max-w-2xl mx-auto leading-relaxed"
            style={{ color: c.textMuted || "#64748b" }}
          >
            Real-time logistics intelligence, flood alerts, and multimodal routing coverage across all 8 North Eastern states.
          </p>
        </div>

        {/* States Flex Container with theme-compliant background and ample gap */}
        <div
          className="rounded-3xl p-6 sm:p-8 md:p-10 shadow-sm border transition-colors duration-300"
          style={{
            background: c.cardBg || "#ffffff",
            borderColor: c.cardBorder || "#e2e8f0",
          }}
        >
          {/* Flexbox container for 8 states */}
          <div className="flex flex-wrap items-center justify-around gap-6 sm:gap-8 md:gap-10">
            {NER_STATES.map((state) => {
              const isHovered = hoveredState?.name === state.name;

              return (
                <div
                  key={state.name}
                  className="group relative flex flex-col items-center cursor-pointer transition-all duration-300"
                  onMouseEnter={() => setHoveredState(state)}
                  onMouseLeave={() => setHoveredState(null)}
                >
                  {/* Floating tooltip badge that reveals on hover */}
                  <div
                    className={`absolute -top-10 z-20 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap shadow-lg transition-all duration-200 pointer-events-none ${isHovered
                      ? "opacity-100 translate-y-0 scale-100"
                      : "opacity-0 translate-y-2 scale-95"
                      }`}
                    style={{
                      background: c.green || "#0a8754",
                      color: "#ffffff",
                    }}
                  >
                    {state.name}
                    <div
                      className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 rotate-45"
                      style={{ background: c.green || "#0a8754" }}
                    />
                  </div>

                  {/* State Map Image container (image does not change on theme change) */}
                  <div className="w-20 h-24 sm:w-24 sm:h-28 md:w-28 md:h-32 flex items-center justify-center p-1 rounded-xl transition-all duration-300 group-hover:-translate-y-2">
                    <img
                      src={state.img}
                      alt={state.name}
                      className="max-w-full max-h-full object-contain filter transition-transform duration-300 group-hover:scale-110 drop-shadow-sm group-hover:drop-shadow-md"
                      loading="lazy"
                    />
                  </div>

                  {/* State Name label beneath image: becomes clearly visible on hover */}
                  <div
                    className={`mt-2 text-xs sm:text-sm font-bold text-center transition-all duration-200 ${isHovered
                      ? "opacity-100 font-extrabold"
                      : "opacity-40 group-hover:opacity-100"
                      }`}
                    style={{
                      color: isHovered
                        ? c.green || "#0a8754"
                        : c.text || "inherit",
                    }}
                  >
                    {state.name}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom active state indicator bar matching user screenshot layout */}
          <div
            className="mt-8 pt-4 border-t flex items-center justify-between flex-wrap gap-2 text-xs font-medium"
            style={{
              borderColor: c.cardBorder || "#e2e8f0",
              color: c.textMuted || "#64748b",
            }}
          >
            <span>Hover any state map to view territory details</span>
            {hoveredState ? (
              <span className="font-bold flex items-center gap-1.5" style={{ color: c.green || "#0a8754" }}>
                <span>Selected:</span>
                <span className="underline">{hoveredState.name} ({hoveredState.code})</span>
                <span className="text-gray-400">• Capital: {hoveredState.capital}</span>
              </span>
            ) : (
              <span className="italic">8 North Eastern Region (NER) States Active</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
