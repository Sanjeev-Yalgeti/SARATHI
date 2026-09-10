import { useEffect, useState } from "react";
import {
  X,
  Truck,
  MapPin,
  Package,
  Calendar,
  AlertTriangle,
  Compass,
  CloudRain,
  ShieldCheck,
  Trash2,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import apiClient from "../api/client";

export default function TripDetailsModal({
  trip,
  c,
  userRole = "ADMIN",
  liveVehicle = null,
  onClose,
  onStatusUpdate,
  onDeleteTrip,
}) {
  const [analysis, setAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = userRole === "ADMIN";
  const isBlocked = liveVehicle?.status === "blocked";

  // Fetch Corridor Risk & Routing analysis for Guwahati -> destination
  useEffect(() => {
    let cancelled = false;

    async function loadCorridorAnalysis() {
      if (!trip) return;
      setLoadingAnalysis(true);
      try {
        const res = await apiClient.post("/api/route/analyze", {
          origin: { lat: 26.1844, lng: 91.7458 },
          destination: { lat: 26.51, lng: 93.97 },
          eventDate: "2026-07-28",
        });
        if (!cancelled && res.data) {
          setAnalysis(res.data);
        }
      } catch (err) {
        // Fallback analysis simulation commented out per user request:
        // if (!cancelled) {
        //   setAnalysis({
        //     blocked: isBlocked || trip.destination.toLowerCase().includes("golaghat"),
        //     delayMessage: isBlocked
        //       ? "Severe flood breach reported on NH-715 near Kaziranga & Barichuwa culvert. Road washed away."
        //       : "Moderate rain along the Brahmaputra south bank; roads passable with caution.",
        //     recommendedRoad: isBlocked
        //       ? "Divert north via Tezpur & NH-15 corridor"
        //       : "Standard NH-27/NH-37 corridor",
        //     risk: {
        //       level: isBlocked ? "RED" : "MEDIUM",
        //       landslide_prob: isBlocked ? 0.82 : 0.35,
        //       score: isBlocked ? 88 : 45,
        //     },
        //   });
        // }
        console.error("[TripDetailsModal] Failed to analyze route corridor:", err);
      } finally {
        if (!cancelled) setLoadingAnalysis(false);
      }
    }

    loadCorridorAnalysis();
    return () => {
      cancelled = true;
    };
  }, [trip, isBlocked]);

  if (!trip) return null;

  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      if (onStatusUpdate) {
        await onStatusUpdate(trip.id, newStatus);
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete trip assignment ${trip.id}?`)) {
      return;
    }
    setDeleting(true);
    try {
      if (onDeleteTrip) {
        await onDeleteTrip(trip.id);
        onClose();
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border"
        style={{ background: c.cardBg, borderColor: c.cardBorder }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-4 shrink-0" style={{ borderColor: c.cardBorder }}>
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0"
              style={{ background: isBlocked ? "#dc2626" : (c.green || "#0a8754") }}
            >
              <Truck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold" style={{ color: c.text }}>
                  Trip Details &bull; {trip.id?.slice(0, 8)}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold font-mono bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {trip.driverId}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                SARATHI Decision Support &bull; Real-Time Corridor Guidance
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-500 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="overflow-y-auto py-5 space-y-5 pr-1 text-sm">
          {/* Active Risk Banner */}
          {analysis?.blocked && (
            <div className="p-4 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 shadow-sm flex items-start gap-3">
              <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} />
              <div>
                <div className="font-extrabold text-sm flex items-center gap-2">
                  <span>CORRIDOR ALERT: ROAD HAZARD / BREACH</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600 text-white font-mono uppercase">
                    {analysis.risk?.level || "RED"}
                  </span>
                </div>
                <p className="text-xs mt-1 text-red-800 dark:text-red-300 leading-relaxed">
                  {analysis.delayMessage}
                </p>
                {analysis.recommendedRoad && (
                  <div className="mt-2 text-xs font-semibold text-emerald-800 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 px-3 py-1.5 rounded-lg inline-block">
                    🧭 Recommendation: {analysis.recommendedRoad}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Key Route Information Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl border bg-white/50 dark:bg-slate-900/40" style={{ borderColor: c.cardBorder }}>
              <div className="text-xs uppercase font-bold text-gray-400 mb-1 flex items-center gap-1.5">
                <MapPin size={14} className="text-emerald-600" />
                <span>Origin &bull; Departure</span>
              </div>
              <div className="font-bold text-base" style={{ color: c.text }}>
                {trip.origin}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Central Logistics Hub, Assam</div>
            </div>

            <div className="p-4 rounded-2xl border bg-white/50 dark:bg-slate-900/40" style={{ borderColor: c.cardBorder }}>
              <div className="text-xs uppercase font-bold text-gray-400 mb-1 flex items-center gap-1.5">
                <MapPin size={14} className="text-red-500" />
                <span>Destination &bull; Dropoff</span>
              </div>
              <div className="font-bold text-base" style={{ color: c.text }}>
                {trip.destination}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Relief Center / Regional Depot</div>
            </div>
          </div>

          {/* Cargo & Live Fleet Telemetry */}
          <div className="p-4 rounded-2xl border bg-white/50 dark:bg-slate-900/40 space-y-3" style={{ borderColor: c.cardBorder }}>
            <h4 className="font-bold text-xs uppercase text-gray-400 tracking-wider">
              Fleet &amp; Cargo Telemetry
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-gray-400 flex items-center gap-1">
                  <Package size={13} /> Cargo Type
                </div>
                <div className="font-bold mt-1 text-sm" style={{ color: c.text }}>
                  {trip.cargoType || "Relief Supplies"}
                </div>
              </div>

              <div>
                <div className="text-gray-400 flex items-center gap-1">
                  <Truck size={13} /> Fleet Status
                </div>
                <div className="font-bold mt-1 text-sm capitalize" style={{ color: isBlocked ? "#dc2626" : (c.green || "#16a34a") }}>
                  {liveVehicle ? liveVehicle.status : trip.status}
                </div>
              </div>

              <div>
                <div className="text-gray-400 flex items-center gap-1">
                  <Compass size={13} /> Current Speed
                </div>
                <div className="font-bold mt-1 text-sm" style={{ color: c.text }}>
                  {liveVehicle ? `${liveVehicle.speed} km/h` : "N/A"}
                </div>
              </div>

              <div>
                <div className="text-gray-400 flex items-center gap-1">
                  <Calendar size={13} /> Assigned Date
                </div>
                <div className="font-bold mt-1 text-sm" style={{ color: c.text }}>
                  {trip.createdAt ? new Date(trip.createdAt).toLocaleDateString() : "2026-07-28"}
                </div>
              </div>
            </div>

            {liveVehicle && (
              <div className="text-[11px] font-mono text-gray-400 pt-2 border-t" style={{ borderColor: c.cardBorder }}>
                Live GPS: {liveVehicle.lat?.toFixed(4)}, {liveVehicle.lng?.toFixed(4)} &bull; Active Sensor Uplink
              </div>
            )}
          </div>

          {/* Intelligence & Weather Breakdown */}
          <div className="p-4 rounded-2xl border bg-white/50 dark:bg-slate-900/40 flex items-center justify-between gap-4" style={{ borderColor: c.cardBorder }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <CloudRain size={20} />
              </div>
              <div>
                <div className="font-bold text-sm" style={{ color: c.text }}>
                  Weather &amp; Hazard Model
                </div>
                <div className="text-xs text-gray-400">
                  {loadingAnalysis ? "Evaluating GIS risk..." : "Monsoon Rain &bull; Landslide Risk Evaluated"}
                </div>
              </div>
            </div>

            <div className="text-right text-xs">
              <div className="font-extrabold text-sm" style={{ color: isBlocked ? "#dc2626" : "#0a8754" }}>
                {analysis?.risk?.level || "NORMAL"}
              </div>
              <div className="text-gray-400">Hazard Index</div>
            </div>
          </div>

          {/* Admin Trip Status Management Actions */}
          {isAdmin && (
            <div className="pt-3 border-t space-y-3" style={{ borderColor: c.cardBorder }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase">
                  Admin Trip Controls
                </span>
                {updatingStatus && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" /> Updating...
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={updatingStatus || trip.status === "assigned"}
                    onClick={() => handleStatusChange("assigned")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                      trip.status === "assigned"
                        ? "bg-blue-100 text-blue-800 border-blue-300"
                        : "bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-transparent"
                    }`}
                  >
                    <Clock size={12} className="inline mr-1" />
                    Set Assigned
                  </button>

                  <button
                    type="button"
                    disabled={updatingStatus || trip.status === "in_progress"}
                    onClick={() => handleStatusChange("in_progress")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                      trip.status === "in_progress"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-transparent"
                    }`}
                  >
                    <ShieldCheck size={12} className="inline mr-1" />
                    Set In Progress
                  </button>

                  <button
                    type="button"
                    disabled={updatingStatus || trip.status === "completed"}
                    onClick={() => handleStatusChange("completed")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                      trip.status === "completed"
                        ? "bg-purple-100 text-purple-800 border-purple-300"
                        : "bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-transparent"
                    }`}
                  >
                    <CheckCircle2 size={12} className="inline mr-1" />
                    Set Completed
                  </button>
                </div>

                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Trash2 size={13} />
                  <span>Delete Trip</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t pt-4 mt-auto flex items-center justify-end shrink-0" style={{ borderColor: c.cardBorder }}>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold bg-gray-200 dark:bg-slate-800 text-gray-800 dark:text-gray-200 hover:opacity-90 cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
