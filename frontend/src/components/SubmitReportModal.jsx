import { useState, useEffect } from "react";
import {
  Camera,
  X,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  MapPin,
  Loader2,
  Sparkles,
} from "lucide-react";
import apiClient from "../api/client";
import {
  haversineDistanceKm,
  formatDistance,
  isWithinRadius,
  PRESET_INCIDENT_LOCATIONS,
} from "../utils/geo";

export default function SubmitReportModal({
  c,
  isOpen = true,
  onClose,
  onSuccess,
  defaultLat = 26.5862,
  defaultLng = 93.3081,
}) {
  const [incidentLat, setIncidentLat] = useState(defaultLat);
  const [incidentLng, setIncidentLng] = useState(defaultLng);

  // User's physical or detected GPS
  const [userLat, setUserLat] = useState(defaultLat + 0.003);
  const [userLng, setUserLng] = useState(defaultLng + 0.003);

  const [road, setRoad] = useState("NH-715 (Old NH-37)");
  const [type, setType] = useState("breach");
  const [severity, setSeverity] = useState("HIGH");
  const [note, setNote] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [detectingGps, setDetectingGps] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Calculate live proximity between user and incident
  const distanceKm = haversineDistanceKm(userLat, userLng, incidentLat, incidentLng);
  const isWithin1Km = isWithinRadius(userLat, userLng, incidentLat, incidentLng, 1.05);

  useEffect(() => {
    // Attempt automatic GPS reading on open
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
        },
        () => {
          // Fallback to close simulation so users can test immediately
          setUserLat(defaultLat + 0.0035);
          setUserLng(defaultLng + 0.0025);
        },
        { timeout: 5000, enableHighAccuracy: true }
      );
    }
  }, [defaultLat, defaultLng]);

  if (!isOpen) return null;

  const handlePresetSelect = (preset) => {
    setIncidentLat(preset.lat);
    setIncidentLng(preset.lng);
    setRoad(preset.road);
    // Automatically keep simulator in range
    setUserLat(preset.lat + 0.003);
    setUserLng(preset.lng + 0.002);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Photo proof must be under 5MB.");
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
    setError("");
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setDetectingGps(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setDetectingGps(false);
      },
      (err) => {
        setDetectingGps(false);
        setError(`Unable to retrieve GPS position: ${err.message}. Using simulated GPS.`);
        setUserLat(incidentLat + 0.003);
        setUserLng(incidentLng + 0.002);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleSimulateNearby = () => {
    // Exact 350m offset (within 1.0 km)
    setUserLat(Number((incidentLat + 0.0025).toFixed(6)));
    setUserLng(Number((incidentLng + 0.002).toFixed(6)));
    setError("");
  };

  const handleSimulateFar = () => {
    // 5 km away (demonstrates rejection of remote report)
    setUserLat(Number((incidentLat + 0.045).toFixed(6)));
    setUserLng(Number((incidentLng + 0.035).toFixed(6)));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isWithin1Km) {
      setError(
        `1.0 km Geofence Violation: You are ${formatDistance(
          distanceKm
        )} away from the hazard location. Photos and breach reports can only be submitted within a 1.0 km proximity of the physical site.`
      );
      return;
    }

    if (!note.trim()) {
      setError("Please describe the incident and road condition.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const formData = new FormData();
    formData.append("lat", incidentLat.toString());
    formData.append("lng", incidentLng.toString());
    formData.append("userLat", userLat.toString());
    formData.append("userLng", userLng.toString());
    formData.append("type", type);
    formData.append("severity", severity);
    formData.append("road", road);
    formData.append("note", note);
    formData.append("eventDate", new Date().toISOString().split("T")[0]);

    if (photoFile) {
      formData.append("photo", photoFile);
    }

    try {
      const res = await apiClient.post("/api/reports", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccessMsg("Report successfully submitted! An administrator will review your photo proof.");
      if (onSuccess) {
        onSuccess(res.data?.report);
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to submit report. Please verify backend is reachable.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-4 shrink-0 border-gray-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Camera size={22} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
                Submit Road Incident &amp; Photo Proof
              </h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 font-medium">
                Public Crowd-Sourced &bull; 1.0 km Proximity Verified Ground Truth
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="overflow-y-auto py-5 space-y-5 pr-1 text-xs sm:text-sm">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1 KM RADIUS VERIFICATION METER */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isWithin1Km
                ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700"
                : "bg-red-50/80 dark:bg-red-950/30 border-red-400 dark:border-red-700"
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div
                className="font-extrabold text-xs uppercase flex items-center gap-1.5"
                style={{ color: isWithin1Km ? "#16a34a" : "#dc2626" }}
              >
                {isWithin1Km ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                <span>1.0 km Radius Condition: {isWithin1Km ? "VERIFIED IN RANGE" : "OUT OF RANGE"}</span>
              </div>
              <div className="text-xs font-bold font-mono text-gray-800 dark:text-gray-200">
                Distance: <span style={{ color: isWithin1Km ? "#16a34a" : "#dc2626" }}>{formatDistance(distanceKm)}</span> (Max: 1.0 km)
              </div>
            </div>

            <p className="text-[11px] text-gray-700 dark:text-gray-300 mb-3 font-medium">
              To guarantee credibility, reports are automatically checked against your current GPS position. You must be physically present within 1 km of the incident.
            </p>

            {/* GPS Simulation / Detection Buttons */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={detectingGps}
                className="px-3 py-1.5 rounded-lg font-bold bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700 flex items-center gap-1.5 cursor-pointer"
              >
                {detectingGps ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
                <span>Detect My GPS</span>
              </button>

              <button
                type="button"
                onClick={handleSimulateNearby}
                className="px-3 py-1.5 rounded-lg font-bold bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles size={13} />
                <span>Simulate In-Range (~350m)</span>
              </button>

              <button
                type="button"
                onClick={handleSimulateFar}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 border border-gray-300 dark:border-slate-700 cursor-pointer"
              >
                Test Out of Range (5 km)
              </button>
            </div>
          </div>

          {/* Quick Preset Hotspot Selection */}
          <div>
            <label className="block font-bold mb-1.5 text-gray-900 dark:text-gray-100">
              Select Known Hotspot or Enter Coordinates
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_INCIDENT_LOCATIONS.map((preset) => {
                const isSelected = road === preset.road;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className={`p-2.5 text-left rounded-xl border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? "border-2 border-emerald-600 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-bold shadow-sm"
                        : "border border-gray-300 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-800/60 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className={isSelected ? "text-emerald-600" : "text-gray-500 dark:text-gray-400"} />
                      <span className="truncate">{preset.name}</span>
                    </div>
                    <div className="text-[10px] text-gray-600 dark:text-gray-400 font-mono mt-0.5">
                      {preset.lat}, {preset.lng}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Incident Type & Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold mb-1.5 text-gray-900 dark:text-gray-100">
                Disruption / Hazard Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-emerald-600 shadow-sm font-medium"
              >
                <option value="breach">Flood Breach (Road Cut / Washed Away)</option>
                <option value="landslide">Landslide / Slope Failure</option>
                <option value="overtop">Water Overtop / Submerged</option>
                <option value="erosion">Riverbank Erosion</option>
                <option value="blockage">Fallen Trees / Debris Blockage</option>
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1.5 text-gray-900 dark:text-gray-100">
                Severity Classification
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-emerald-600 shadow-sm font-medium"
              >
                <option value="RED">RED &bull; Impassable / Total Road Block</option>
                <option value="HIGH">HIGH &bull; Heavy Disruption (Trucks Stalled)</option>
                <option value="MEDIUM">MEDIUM &bull; Passable with Caution</option>
                <option value="LOW">LOW &bull; Minor Hazard / Pothole</option>
              </select>
            </div>
          </div>

          {/* Road / Location Name */}
          <div>
            <label className="block font-bold mb-1.5 text-gray-900 dark:text-gray-100">
              Road / Landmark Name
            </label>
            <input
              type="text"
              value={road}
              onChange={(e) => setRoad(e.target.value)}
              placeholder="e.g. NH-715, Near Kaziranga KM 2"
              className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-emerald-600 shadow-sm font-medium"
            />
          </div>

          {/* Photo Proof Upload */}
          <div>
            <label className="block font-bold mb-1.5 text-gray-900 dark:text-gray-100">
              Photo Proof (Required for Verification)
            </label>

            <div
              className="border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-colors relative bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 border-gray-300 dark:border-slate-600"
              style={{ borderColor: photoPreview ? "#10b981" : undefined }}
            >
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />

              {photoPreview ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={photoPreview}
                    alt="Incident Proof Preview"
                    className="h-36 w-auto max-w-full rounded-xl object-cover shadow-md border border-gray-300 dark:border-slate-700"
                  />
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 size={14} /> Photo Attached ({photoFile?.name})
                  </span>
                  <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">Click or drag another image to replace</span>
                </div>
              ) : (
                <div className="py-4 flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                    <Upload size={22} />
                  </div>
                  <div className="font-bold text-sm text-gray-900 dark:text-gray-100">
                    Click or Drag &amp; Drop Photo Proof
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                    JPG, PNG or WEBP up to 5MB
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description / Field Note */}
          <div>
            <label className="block font-bold mb-1.5 text-gray-900 dark:text-gray-100">
              Incident Description &amp; Field Note
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe road blockage, water level, or landslide extent..."
              className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-emerald-600 shadow-sm font-medium"
            />
          </div>

          {/* Action Buttons */}
          <div className="border-t pt-4 flex items-center justify-end gap-3 border-gray-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-300 dark:border-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isWithin1Km}
              className="px-6 py-2.5 rounded-xl font-bold text-white shadow-lg hover:opacity-95 cursor-pointer flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: isWithin1Km ? "#0a8754" : "#9ca3af" }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Submitting Proof...</span>
                </>
              ) : (
                <>
                  <Camera size={16} />
                  <span>Submit Verified Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
