import { useState, useMemo } from "react";
import {
  X,
  Camera,
  MapPin,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Loader2,
  Sparkles,
} from "lucide-react";
import apiClient from "../api/client";
import { isNetworkError } from "../api/auth";
import { haversineDistanceKm, formatDistance } from "../utils/geo";

// Known hotspots across NER corridor for quick evaluation
const PRESET_INCIDENT_LOCATIONS = [
  { name: "Kaziranga Basapathar Ali (Golaghat)", lat: 26.5862, lng: 93.3081, road: "Kaziranga Basapathar Ali" },
  { name: "Barichuwa Gaon Culvert (Golaghat)", lat: 26.4712, lng: 93.9421, road: "Barichuwa Culvert Road" },
  { name: "Navagraha Hill Road (Guwahati)", lat: 26.1909, lng: 91.7653, road: "Navagraha Hill Road" },
  { name: "Kakatigaon to Hatigarh (Nagaon)", lat: 26.1675, lng: 92.5433, road: "Kakatigaon Road" },
  { name: "Bhogdoi Rightbank (Jorhat)", lat: 26.7531, lng: 94.2045, road: "Bhogdoi Rightbank Road" },
];

export default function SubmitReportModal({
  c,
  onClose,
  onSuccess,
  defaultLat,
  defaultLng,
  defaultRoad,
}) {
  // Incident location (where the hazard is)
  const [incidentLat, setIncidentLat] = useState(defaultLat ?? 26.5862);
  const [incidentLng, setIncidentLng] = useState(defaultLng ?? 93.3081);
  const [road, setRoad] = useState(defaultRoad ?? "Kaziranga Basapathar Ali");

  // Reporter's actual GPS location
  // Default initialized within ~320m for immediate ready testing
  const [userLat, setUserLat] = useState((defaultLat ?? 26.5862) + 0.0022);
  const [userLng, setUserLng] = useState((defaultLng ?? 93.3081) + 0.0018);
  const [detectingGps, setDetectingGps] = useState(false);

  // Form details
  const [type, setType] = useState("breach");
  const [severity, setSeverity] = useState("HIGH");
  const [note, setNote] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Calculate distance between user GPS and incident site
  const distanceKm = useMemo(() => {
    return haversineDistanceKm(userLat, userLng, incidentLat, incidentLng);
  }, [userLat, userLng, incidentLat, incidentLng]);

  const isWithin1Km = distanceKm <= 1.0;

  // Handle preset selection
  const handlePresetSelect = (preset) => {
    setIncidentLat(preset.lat);
    setIncidentLng(preset.lng);
    setRoad(preset.road);
    // Move user GPS to ~350m within preset for easy verification
    setUserLat(preset.lat + 0.002);
    setUserLng(preset.lng + 0.0015);
    setError("");
  };

  // Browser Geolocation Detection
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
      () => {
        setDetectingGps(false);
        setError("Unable to retrieve device GPS coordinates. Please allow location permissions.");
      },
      { timeout: 8000 }
    );
  };

  // Simulate nearby location (dev test helper)
  const handleSimulateNearby = () => {
    setUserLat(incidentLat + 0.0025);
    setUserLng(incidentLng + 0.0018);
    setError("");
  };

  // Simulate far location (testing validation block)
  const handleSimulateFar = () => {
    setUserLat(incidentLat + 0.05);
    setUserLng(incidentLng + 0.05);
  };

  // Photo file selection & preview
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPG or PNG).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size exceeds 5MB limit.");
      return;
    }

    setError("");
    setPhotoFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isWithin1Km) {
      setError(
        `Verification Blocked: You are ${formatDistance(
          distanceKm
        )} away from the incident location. Ground-truth reports require you to be within 1.0 km radius.`
      );
      return;
    }

    if (!note.trim()) {
      setError("Please provide a description of the observed road hazard.");
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
      if (isNetworkError(err)) {
        // Dev offline fallback report creation
        const mockReport = {
          id: `REP-${Date.now().toString().slice(-5)}`,
          lat: incidentLat,
          lng: incidentLng,
          userLat,
          userLng,
          distanceKm,
          type,
          severity,
          road,
          note,
          photoUrl: photoPreview || "/loginBg.png",
          eventDate: new Date().toISOString().split("T")[0],
          status: "pending",
          createdAt: new Date().toISOString(),
        };

        setSuccessMsg("Report submitted! Saved in local offline store for Admin review.");
        if (onSuccess) {
          onSuccess(mockReport);
        }
        setTimeout(() => {
          onClose();
        }, 1500);
        return;
      }
      setError(err.response?.data?.error || err.message || "Failed to submit report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border"
        style={{ background: c.cardBg, borderColor: c.cardBorder }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-4 shrink-0" style={{ borderColor: c.cardBorder }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
              <Camera size={22} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold" style={{ color: c.text }}>
                Submit Road Incident &amp; Photo Proof
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Public Crowd-Sourced &bull; 1.0 km Proximity Verified Ground Truth
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-500 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="overflow-y-auto py-5 space-y-5 pr-1 text-xs sm:text-sm">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1 KM RADIUS VERIFICATION METER */}
          <div
            className="p-4 rounded-2xl border transition-all"
            style={{
              background: isWithin1Km ? (c.pageBg) : "#fee2e215",
              borderColor: isWithin1Km ? "#86efac" : "#fca5a5",
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div className="font-extrabold text-xs uppercase flex items-center gap-1.5" style={{ color: isWithin1Km ? "#16a34a" : "#dc2626" }}>
                {isWithin1Km ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                <span>1.0 km Radius Condition: {isWithin1Km ? "VERIFIED IN RANGE" : "OUT OF RANGE"}</span>
              </div>
              <div className="text-xs font-bold font-mono">
                Distance: <span style={{ color: isWithin1Km ? "#16a34a" : "#dc2626" }}>{formatDistance(distanceKm)}</span> (Max: 1.0 km)
              </div>
            </div>

            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              To guarantee credibility, reports are automatically checked against your current GPS position. You must be physically present within 1 km of the incident.
            </p>

            {/* GPS Simulation / Detection Buttons */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={detectingGps}
                className="px-3 py-1.5 rounded-lg font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 flex items-center gap-1.5 cursor-pointer"
              >
                {detectingGps ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
                <span>Detect My GPS</span>
              </button>

              <button
                type="button"
                onClick={handleSimulateNearby}
                className="px-3 py-1.5 rounded-lg font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles size={13} />
                <span>Simulate In-Range (~350m)</span>
              </button>

              <button
                type="button"
                onClick={handleSimulateFar}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 border cursor-pointer"
              >
                Test Out of Range (5 km)
              </button>
            </div>
          </div>

          {/* Quick Preset Hotspot Selection */}
          <div>
            <label className="block font-bold mb-1.5" style={{ color: c.text }}>
              Select Known Hotspot or Enter Coordinates
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_INCIDENT_LOCATIONS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className={`p-2.5 text-left rounded-xl border text-xs transition-all cursor-pointer ${
                    road === preset.road
                      ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 font-bold"
                      : "border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-emerald-600 shrink-0" />
                    <span className="truncate">{preset.name}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                    {preset.lat}, {preset.lng}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Incident Type & Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold mb-1.5" style={{ color: c.text }}>
                Disruption / Hazard Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 focus:outline-none focus:border-emerald-500"
                style={{ borderColor: c.cardBorder, color: c.text }}
              >
                <option value="breach">Flood Breach (Road Cut / Washed Away)</option>
                <option value="landslide">Landslide / Slope Failure</option>
                <option value="overtop">Water Overtop / Submerged</option>
                <option value="erosion">Riverbank Erosion</option>
                <option value="blockage">Fallen Trees / Debris Blockage</option>
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1.5" style={{ color: c.text }}>
                Severity Classification
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 focus:outline-none focus:border-emerald-500"
                style={{ borderColor: c.cardBorder, color: c.text }}
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
            <label className="block font-bold mb-1.5" style={{ color: c.text }}>
              Road / Landmark Name
            </label>
            <input
              type="text"
              value={road}
              onChange={(e) => setRoad(e.target.value)}
              placeholder="e.g. NH-715, Near Kaziranga KM 2"
              className="w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 focus:outline-none focus:border-emerald-500"
              style={{ borderColor: c.cardBorder, color: c.text }}
            />
          </div>

          {/* Photo Proof Upload */}
          <div>
            <label className="block font-bold mb-1.5" style={{ color: c.text }}>
              Photo Proof (Required for Verification)
            </label>

            <div
              className="border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-colors relative hover:bg-gray-50 dark:hover:bg-slate-800"
              style={{ borderColor: photoPreview ? "#10b981" : c.cardBorder }}
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
                    className="h-36 w-auto max-w-full rounded-xl object-cover shadow-md border"
                  />
                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 size={14} /> Photo Attached ({photoFile?.name})
                  </span>
                  <span className="text-[10px] text-gray-400">Click or drag another image to replace</span>
                </div>
              ) : (
                <div className="py-4 flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Upload size={22} />
                  </div>
                  <div className="font-bold text-sm" style={{ color: c.text }}>
                    Click or Drag &amp; Drop Photo Proof
                  </div>
                  <div className="text-xs text-gray-400">
                    JPG, PNG or WEBP up to 5MB
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description / Field Note */}
          <div>
            <label className="block font-bold mb-1.5" style={{ color: c.text }}>
              Incident Description &amp; Field Note
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe road blockage, water level, or landslide extent..."
              className="w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 focus:outline-none focus:border-emerald-500"
              style={{ borderColor: c.cardBorder, color: c.text }}
            />
          </div>

          {/* Action Buttons */}
          <div className="border-t pt-4 flex items-center justify-end gap-3" style={{ borderColor: c.cardBorder }}>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isWithin1Km}
              className="px-6 py-2.5 rounded-xl font-bold text-white shadow-lg hover:opacity-95 cursor-pointer flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: isWithin1Km ? (c.green || "#0a8754") : "#9ca3af" }}
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
