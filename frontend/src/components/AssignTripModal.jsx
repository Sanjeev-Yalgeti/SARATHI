import { useState } from "react";
import { X, Plus, Truck, MapPin, Package, Loader2 } from "lucide-react";

const SEED_DRIVERS = [
  { id: "AS-01-FOOD-04", name: "Driver 1 (Food & Rations Truck)" },
  { id: "AS-02-MED-11", name: "Driver 2 (Medical Supplies Truck)" },
  { id: "AS-03-FUEL-07", name: "Driver 3 (Fuel & Energy Truck)" },
];

export default function AssignTripModal({ c, onClose, onSubmitTrip }) {
  const [driverId, setDriverId] = useState("AS-01-FOOD-04");
  const [origin, setOrigin] = useState("Guwahati, Assam");
  const [destination, setDestination] = useState("Golaghat relief camp, Assam");
  const [cargoType, setCargoType] = useState("rice + emergency medicines");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!driverId || !origin || !destination) {
      setError("Please fill in Driver, Origin, and Destination.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onSubmitTrip({
        driverId,
        origin,
        destination,
        cargoType,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to create trip assignment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border"
        style={{ background: c.cardBg, borderColor: c.cardBorder }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 mb-5" style={{ borderColor: c.cardBorder }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-lg" style={{ color: c.text }}>
                Assign New Logistics Trip
              </h3>
              <p className="text-xs text-gray-400">
                Dispatch relief assets with real-time hazard monitoring
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-500 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Driver Selection */}
          <div>
            <label className="block font-bold mb-1.5" style={{ color: c.text }}>
              Select Truck Driver / Vehicle ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Truck size={16} />
              </div>
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                style={{ borderColor: c.cardBorder, color: c.text }}
              >
                {SEED_DRIVERS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id} &bull; {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Origin */}
          <div>
            <label className="block font-bold mb-1.5" style={{ color: c.text }}>
              Origin (Departure Hub)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-600">
                <MapPin size={16} />
              </div>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Guwahati Logistics Base"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 focus:outline-none focus:border-emerald-500"
                style={{ borderColor: c.cardBorder, color: c.text }}
              />
            </div>
          </div>

          {/* Destination */}
          <div>
            <label className="block font-bold mb-1.5" style={{ color: c.text }}>
              Destination (Relief Camp / Depot)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-red-500">
                <MapPin size={16} />
              </div>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Golaghat relief camp"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 focus:outline-none focus:border-emerald-500"
                style={{ borderColor: c.cardBorder, color: c.text }}
              />
            </div>
          </div>

          {/* Cargo Type */}
          <div>
            <label className="block font-bold mb-1.5" style={{ color: c.text }}>
              Cargo Description &amp; Priority
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-500">
                <Package size={16} />
              </div>
              <input
                type="text"
                value={cargoType}
                onChange={(e) => setCargoType(e.target.value)}
                placeholder="e.g. rice + water packets + first aid"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 focus:outline-none focus:border-emerald-500"
                style={{ borderColor: c.cardBorder, color: c.text }}
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-4 border-t flex items-center justify-end gap-2.5" style={{ borderColor: c.cardBorder }}>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl font-bold text-white shadow-md hover:opacity-95 cursor-pointer flex items-center gap-2"
              style={{ background: c.green || "#0a8754" }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Assigning...</span>
                </>
              ) : (
                <span>Confirm Assignment</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
