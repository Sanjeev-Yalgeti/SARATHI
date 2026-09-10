import { Truck, MapPin, Package, Clock, ShieldAlert, ArrowRight, Activity } from "lucide-react";

export default function TripCard({
  trip,
  c,
  liveVehicle = null,
  onViewDetails
}) {
  const isBlocked = liveVehicle?.status === "blocked";
  const isMoving = liveVehicle?.status === "moving";

  // Map backend status to human label and badge styling
  const statusMap = {
    in_progress: { label: "In Progress", color: "#16a34a", bg: "#dcfce7" },
    assigned: { label: "Assigned", color: "#2563eb", bg: "#dbeafe" },
    completed: { label: "Completed", color: "#6b7280", bg: "#f3f4f6" },
  };

  const statusInfo = isBlocked
    ? { label: "Blocked by Flood", color: "#dc2626", bg: "#fee2e2" }
    : statusMap[trip.status] || { label: trip.status || "Active", color: "#16a34a", bg: "#dcfce7" };

  return (
    <div
      className="rounded-2xl p-5 sm:p-6 transition-all duration-200 hover:shadow-md border flex flex-col justify-between gap-4 relative overflow-hidden"
      style={{
        background: c.cardBg,
        borderColor: isBlocked ? "#f87171" : c.cardBorder,
      }}
    >
      {/* Top Header: ID, Driver Tag, Status Badge */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: isBlocked ? "#fee2e2" : "#e0f2fe",
              color: isBlocked ? "#dc2626" : "#0284c7",
            }}
          >
            <Truck size={20} />
          </div>
          <div>
            <div className="font-extrabold text-base flex items-center gap-2" style={{ color: c.text }}>
              <span>{trip.id?.slice(0, 8) || "TRP-NEW"}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {trip.driverId}
              </span>
            </div>
            <div className="text-xs font-medium flex items-center gap-1 mt-0.5" style={{ color: c.textMuted }}>
              <Package size={12} />
              <span>{trip.cargoType || "Standard Cargo"}</span>
            </div>
          </div>
        </div>

        {/* Status Pill Badge */}
        <div className="flex items-center gap-2">
          {isBlocked && (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
            </span>
          )}
          <span
            className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1"
            style={{ background: statusInfo.bg, color: statusInfo.color }}
          >
            {isBlocked && <ShieldAlert size={12} />}
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Corridor Route Details: Origin -> Destination */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-1">
        <div className="flex items-start gap-2">
          <MapPin size={16} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-[11px] uppercase font-bold text-gray-400">Origin</div>
            <div className="font-bold text-sm" style={{ color: c.text }}>
              {trip.origin}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <MapPin size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-[11px] uppercase font-bold text-gray-400">Destination</div>
            <div className="font-bold text-sm" style={{ color: c.text }}>
              {trip.destination}
            </div>
          </div>
        </div>
      </div>

      {/* Live Telemetry Bar & Action Button */}
      <div className="pt-3 border-t flex items-center justify-between flex-wrap gap-3" style={{ borderColor: c.cardBorder }}>
        {/* Real-time telemetry summary */}
        <div className="flex items-center gap-4 text-xs font-medium" style={{ color: c.textMuted }}>
          {liveVehicle ? (
            <>
              <div className="flex items-center gap-1.5">
                <Activity size={14} className={isMoving ? "text-emerald-500 animate-pulse" : "text-gray-400"} />
                <span>Speed:</span>
                <b style={{ color: isBlocked ? "#dc2626" : c.text }}>
                  {liveVehicle.speed} km/h
                </b>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: isBlocked ? "#dc2626" : (isMoving ? "#16a34a" : "#9ca3af") }} />
                <span className="capitalize">{liveVehicle.status}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <Clock size={14} />
              <span>Status: <b className="capitalize" style={{ color: c.text }}>{trip.status || "Assigned"}</b></span>
            </div>
          )}
        </div>

        {/* View Details CTA */}
        <button
          type="button"
          onClick={() => onViewDetails(trip)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer text-white shadow-sm hover:opacity-90 active:scale-95"
          style={{ background: c.green || "#0a8754" }}
        >
          <span>View Details</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
