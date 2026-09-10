import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Truck, RefreshCw } from "lucide-react";
import apiClient from "../api/client";
import { isNetworkError } from "../api/auth";
import TripCard from "../components/TripCard";
import TripDetailsModal from "../components/TripDetailsModal";
import AssignTripModal from "../components/AssignTripModal";

// Seed fallback trips when backend is offline for dev testing
const FALLBACK_SEEDED_TRIPS = [
  {
    id: "TRP-7845-AS01",
    driverId: "AS-01-FOOD-04",
    origin: "Guwahati, Assam",
    destination: "Golaghat relief camp, Assam",
    cargoType: "rice + emergency medicines",
    status: "in_progress",
    createdAt: "2026-07-28T04:30:00.000Z",
  },
  {
    id: "TRP-7846-AS02",
    driverId: "AS-02-MED-11",
    origin: "Guwahati, Assam",
    destination: "Sivasagar Civil Hospital, Assam",
    cargoType: "vital medicines + surgical packs",
    status: "in_progress",
    createdAt: "2026-07-28T05:15:00.000Z",
  },
  {
    id: "TRP-7847-AS03",
    driverId: "AS-03-FUEL-07",
    origin: "Guwahati, Assam",
    destination: "Sivasagar via Nagaon, Assam",
    cargoType: "high-octane diesel for generators",
    status: "assigned",
    createdAt: "2026-07-28T06:00:00.000Z",
  },
];

export default function TripsPage({ c, userRole = "ADMIN", currentUser = null }) {
  const [tab, setTab] = useState("all");
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLiveTelemetry, setIsLiveTelemetry] = useState(false);

  const isAdmin = userRole === "ADMIN";
  const isDriver = userRole === "DRIVER" || userRole === "restricted";
  const driverVehicleId = currentUser?.id;

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Poll Trips and Vehicles for real-time telemetry (speed, status, GPS)
  useEffect(() => {
    let cancelled = false;

    async function loadTrips() {
      try {
        const res = await apiClient.get("/api/trips");
        if (!cancelled && res.data?.trips) {
          setTrips(res.data.trips);
        }
      } catch (err) {
        if (!cancelled && isNetworkError(err)) {
          setTrips((prev) => (prev.length > 0 ? prev : FALLBACK_SEEDED_TRIPS));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTrips();

    let timer = null;
    const pollVehicles = async () => {
      try {
        const res = await apiClient.get("/api/vehicles");
        if (!cancelled && res.data?.vehicles) {
          setVehicles(res.data.vehicles);
          setIsLiveTelemetry(true);
        }
      } catch {
        if (!cancelled) {
          setIsLiveTelemetry(false);
          setVehicles([
            { vehicleId: "AS-01-FOOD-04", status: "blocked", speed: 0, lat: 26.54, lng: 93.35 },
            { vehicleId: "AS-02-MED-11", status: "moving", speed: 48, lat: 26.35, lng: 92.68 },
            { vehicleId: "AS-03-FUEL-07", status: "moving", speed: 52, lat: 26.22, lng: 91.95 },
          ]);
        }
      }
    };

    void pollVehicles();
    timer = setInterval(pollVehicles, 2500);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  // Map vehicle telemetry by driverId
  const vehicleMap = useMemo(() => {
    const map = new Map();
    vehicles.forEach((v) => map.set(v.vehicleId, v));
    return map;
  }, [vehicles]);

  // Scoping: Drivers only see trips assigned to their vehicleId
  const scopedTrips = useMemo(() => {
    if (isDriver && driverVehicleId) {
      return trips.filter((t) => t.driverId === driverVehicleId);
    }
    return trips;
  }, [trips, isDriver, driverVehicleId]);

  // Filtered by tab status
  const displayedTrips = useMemo(() => {
    if (tab === "ongoing") {
      return scopedTrips.filter((t) => t.status === "in_progress");
    }
    if (tab === "upcoming") {
      return scopedTrips.filter((t) => t.status === "assigned");
    }
    if (tab === "completed") {
      return scopedTrips.filter((t) => t.status === "completed");
    }
    return scopedTrips;
  }, [scopedTrips, tab]);

  // Handle Admin Trip Creation (POST /api/trips)
  const handleCreateTrip = async (newTripData) => {
    try {
      const res = await apiClient.post("/api/trips", newTripData);
      if (res.data?.trip) {
        setTrips((prev) => [res.data.trip, ...prev]);
      }
    } catch (err) {
      if (isNetworkError(err)) {
        // Offline dev fallback creation
        const localTrip = {
          id: `TRP-${Date.now().toString().slice(-4)}-${newTripData.driverId.slice(0, 4)}`,
          ...newTripData,
          status: "assigned",
          createdAt: new Date().toISOString(),
        };
        setTrips((prev) => [localTrip, ...prev]);
        return;
      }
      throw err;
    }
  };

  // Handle Admin Status Update (PATCH /api/trips/:id)
  const handleUpdateStatus = async (tripId, newStatus) => {
    try {
      await apiClient.patch(`/api/trips/${tripId}`, { status: newStatus });
      setTrips((prev) =>
        prev.map((t) => (t.id === tripId ? { ...t, status: newStatus } : t))
      );
      if (selectedTrip?.id === tripId) {
        setSelectedTrip((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err) {
      if (isNetworkError(err)) {
        setTrips((prev) =>
          prev.map((t) => (t.id === tripId ? { ...t, status: newStatus } : t))
        );
        if (selectedTrip?.id === tripId) {
          setSelectedTrip((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
        return;
      }
      throw err;
    }
  };

  // Handle Admin Trip Deletion (DELETE /api/trips/:id)
  const handleDeleteTrip = async (tripId) => {
    try {
      await apiClient.delete(`/api/trips/${tripId}`);
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
    } catch (err) {
      if (isNetworkError(err)) {
        setTrips((prev) => prev.filter((t) => t.id !== tripId));
        return;
      }
      throw err;
    }
  };

  // Counts for tabs
  const countAll = scopedTrips.length;
  const countOngoing = scopedTrips.filter((t) => t.status === "in_progress").length;
  const countUpcoming = scopedTrips.filter((t) => t.status === "assigned").length;
  const countCompleted = scopedTrips.filter((t) => t.status === "completed").length;

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold mb-1" style={{ color: c.text }}>
            {isDriver ? "My Assigned Trips" : "Fleet Trips & Dispatch"}
          </h1>
          <p className="text-sm sm:text-base" style={{ color: c.textMuted }}>
            {isDriver
              ? `Operational route telemetry for your vehicle (${driverVehicleId || "Driver"})`
              : "Manage real-time logistics corridors, driver trip assignments, and live blockage alerts."}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400">
            <RefreshCw size={13} className={isLiveTelemetry ? "text-emerald-500 animate-spin" : ""} />
            <span>{isLiveTelemetry ? "Live 2.5s Sync" : "Dev Offline Sync"}</span>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(true)}
              className="px-5 py-2.5 rounded-xl font-bold text-white shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 cursor-pointer text-xs sm:text-sm"
              style={{ background: c.green || "#0a8754" }}
            >
              <Plus size={16} />
              <span>Assign New Trip</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 sm:gap-8 border-b text-xs sm:text-sm font-semibold overflow-x-auto pb-1" style={{ borderColor: c.cardBorder }}>
        {[
          { key: "all", label: `All Trips (${countAll})` },
          { key: "ongoing", label: `Ongoing (${countOngoing})` },
          { key: "upcoming", label: `Upcoming (${countUpcoming})` },
          { key: "completed", label: `Completed (${countCompleted})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="pb-2.5 transition-colors cursor-pointer shrink-0 border-b-2"
            style={{
              color: tab === t.key ? (c.green || "#0a8754") : c.textMuted,
              borderColor: tab === t.key ? (c.green || "#0a8754") : "transparent",
              fontWeight: tab === t.key ? 700 : 500,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Trip Cards Grid */}
      {loading ? (
        <div className="text-center py-16" style={{ color: c.textMuted }}>
          <div className="animate-spin w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm">Synchronizing operational trips and live fleet telemetry...</p>
        </div>
      ) : displayedTrips.length === 0 ? (
        <div
          className="text-center py-16 rounded-2xl border p-8 space-y-3"
          style={{ background: c.cardBg, borderColor: c.cardBorder }}
        >
          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-400 flex items-center justify-center mx-auto">
            <Truck size={24} />
          </div>
          <h3 className="font-bold text-base" style={{ color: c.text }}>
            No Trips Found in this Category
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {isAdmin
              ? "You haven't dispatched any trips in this status category yet. Click 'Assign New Trip' above to dispatch a relief truck."
              : "No trips currently assigned matching this category."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedTrips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              c={c}
              liveVehicle={vehicleMap.get(trip.driverId)}
              onViewDetails={(t) => setSelectedTrip(t)}
            />
          ))}
        </div>
      )}

      {/* In-Depth Trip Details Modal */}
      {selectedTrip && (
        <TripDetailsModal
          trip={selectedTrip}
          c={c}
          userRole={userRole}
          liveVehicle={vehicleMap.get(selectedTrip.driverId)}
          onClose={() => setSelectedTrip(null)}
          onStatusUpdate={handleUpdateStatus}
          onDeleteTrip={handleDeleteTrip}
        />
      )}

      {/* Admin Assign Trip Modal */}
      {isAssignModalOpen && (
        <AssignTripModal
          c={c}
          onClose={() => setIsAssignModalOpen(false)}
          onSubmitTrip={handleCreateTrip}
        />
      )}
    </div>
  );
}
