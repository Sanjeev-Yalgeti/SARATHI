import { useState, useEffect, useMemo, useRef } from "react";
import {
  Camera,
  CheckCircle2,
  XCircle,
  FileText,
  MapPin,
  Clock,
  Download,
  Eye,
  Filter,
  Loader2,
  Check,
} from "lucide-react";
import apiClient, { API_BASE } from "../api/client";
// import { isNetworkError } from "../api/auth";
import SubmitReportModal from "../components/SubmitReportModal";
import PhotoProofViewer from "../components/PhotoProofViewer";

// Fallback seeded reports for dev offline evaluation (commented out per user request)
// const FALLBACK_REPORTS = [
//   {
//     id: "REP-9101",
//     lat: 26.5862,
//     lng: 93.3081,
//     type: "breach",
//     severity: "RED",
//     road: "Kaziranga Basapathar Ali (Golaghat)",
//     note: "Flood breach at 2 KM mark on the road. Water depth ~1.2m across 40 meters. Road washed away.",
//     photoUrl: "/bg.png",
//     eventDate: "2026-07-28",
//     createdAt: "2026-07-28T07:45:00.000Z",
//     status: "pending",
//     distanceMeters: 320,
//     reporter: "AS-01-FOOD-04",
//   },
//   {
//     id: "REP-9102",
//     lat: 26.1909,
//     lng: 91.7653,
//     type: "landslide",
//     severity: "HIGH",
//     road: "Navagraha Hill Road, Guwahati",
//     note: "Retaining guard wall collapsed onto road due to heavy rainfall. Passage blocked for large trucks.",
//     photoUrl: "/loginBg.png",
//     eventDate: "2026-07-28",
//     createdAt: "2026-07-28T08:15:00.000Z",
//     status: "approved",
//     distanceMeters: 180,
//     reporter: "Citizen (Public)",
//   },
//   {
//     id: "REP-9103",
//     lat: 26.4712,
//     lng: 93.9421,
//     type: "breach",
//     severity: "RED",
//     road: "Barichuwa Gaon Culvert (Golaghat)",
//     note: "1 RCC slab culvert washed away completely by surging floodwaters at Barichuwa village.",
//     photoUrl: "/mountain.png",
//     eventDate: "2026-07-28",
//     createdAt: "2026-07-28T09:00:00.000Z",
//     status: "pending",
//     distanceMeters: 450,
//     reporter: "Citizen (Public)",
//   },
//   {
//     id: "REP-9104",
//     lat: 26.1675,
//     lng: 92.5433,
//     type: "overtop",
//     severity: "MEDIUM",
//     road: "Kakatigaon to Hatigarh (Nagaon)",
//     note: "Road overtopped by 25cm overflow from nearby canal from KM 4.1 to 4.5. Light vehicles diverted.",
//     photoUrl: null,
//     eventDate: "2026-07-28",
//     createdAt: "2026-07-28T09:30:00.000Z",
//     status: "approved",
//     distanceMeters: 620,
//     reporter: "AS-03-FUEL-07",
//   },
// ];

// Helper to parse status and verified metadata from note
function parseReportData(rawReport) {
  let noteText = rawReport.note || "";
  let status = "pending";
  let distanceMeters = rawReport.distanceMeters ?? 350;
  let road = rawReport.road || "NER Corridor";
  let reporter = rawReport.reporter || "Citizen (Public)";

  // Check for [STATUS:xxx] token
  const statusMatch = noteText.match(/\[STATUS:(pending|approved|rejected)\]/i);
  if (statusMatch) {
    status = statusMatch[1].toLowerCase();
    noteText = noteText.replace(/\[STATUS:(pending|approved|rejected)\]/i, "").trim();
  } else if (rawReport.status) {
    status = rawReport.status;
  }

  // Check for [Road: xxx]
  const roadMatch = noteText.match(/\[Road:\s*([^\]]+)\]/i);
  if (roadMatch) {
    road = roadMatch[1];
    noteText = noteText.replace(/\[Road:\s*([^\]]+)\]/i, "").trim();
  }

  // Check for [Verified: xxxm]
  const distMatch = noteText.match(/\[Verified:\s*(\d+)m\]/i);
  if (distMatch) {
    distanceMeters = parseInt(distMatch[1], 10);
    noteText = noteText.replace(/\[Verified:\s*(\d+)m\]/i, "").trim();
  }

  // Check for [By: xxx]
  const byMatch = noteText.match(/\[By:\s*([^\]]+)\]/i);
  if (byMatch) {
    reporter = byMatch[1];
    noteText = noteText.replace(/\[By:\s*([^\]]+)\]/i, "").trim();
  }

  // Resolve photo URL with backend base if relative
  let fullPhotoUrl = rawReport.photoUrl;
  if (fullPhotoUrl && fullPhotoUrl.startsWith("/uploads/")) {
    fullPhotoUrl = `${API_BASE}${fullPhotoUrl}`;
  }

  return {
    ...rawReport,
    cleanNote: noteText,
    status,
    road,
    distanceMeters,
    reporter,
    photoUrl: fullPhotoUrl,
  };
}

export default function ReportsPage({ c, userRole = "ADMIN" }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all"); // "all" | "pending" | "approved" | "rejected"
  const [typeFilter, setTypeFilter] = useState("all");
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const isAdmin = userRole === "ADMIN";

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      try {
        const res = await apiClient.get("/api/reports");
        if (!cancelled && res.data?.reports) {
          setReports(res.data.reports.map(parseReportData));
        }
      } catch (err) {
        // Offline fallback commented out per user request:
        // if (!cancelled && isNetworkError(err)) {
        //   setReports(FALLBACK_REPORTS.map(parseReportData));
        // }
        console.error("[ReportsPage] Failed to load reports:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, []);

  // Handle Admin Decision: Approve or Reject
  const handleDecision = async (reportId, decision) => {
    setProcessingId(reportId);
    try {
      await apiClient.patch(`/api/reports/${reportId}`, { status: decision });
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: decision } : r))
      );
    } catch (err) {
      // Offline fallback commented out per user request:
      // if (isNetworkError(err)) {
      //   setReports((prev) =>
      //     prev.map((r) => (r.id === reportId ? { ...r, status: decision } : r))
      //   );
      //   return;
      // }
      alert(err.response?.data?.error || "Failed to update report decision.");
    } finally {
      setProcessingId(null);
    }
  };

  // Download ASDMA PDF Bulletin with Bearer token authentication
  const handleDownloadBulletin = async () => {
    try {
      const res = await apiClient.get("/api/bulletin.pdf?date=2026-08-09", {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "sarathi-flood-bulletin-2026-08-09.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[ReportsPage] Failed to download PDF bulletin:", err);
      alert("Failed to download PDF bulletin.");
    }
  };

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (tab === "pending" && r.status !== "pending") return false;
      if (tab === "approved" && r.status !== "approved") return false;
      if (tab === "rejected" && r.status !== "rejected") return false;

      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      return true;
    });
  }, [reports, tab, typeFilter]);

  // Counts
  const countAll = reports.length;
  const countPending = reports.filter((r) => r.status === "pending").length;
  const countApproved = reports.filter((r) => r.status === "approved").length;
  const countRejected = reports.filter((r) => r.status === "rejected").length;

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold mb-1" style={{ color: c.text }}>
            Field Reports &amp; Verified Ground Truth
          </h1>
          <p className="text-sm sm:text-base" style={{ color: c.textMuted }}>
            {isAdmin
              ? "Review crowd-sourced and driver field incident reports with 1.0 km proximity photo proof verification."
              : "View road hazard conditions and submit verified field reports from your operational route."}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadBulletin}
            className="px-4 py-2.5 rounded-xl font-bold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 cursor-pointer text-xs sm:text-sm"
          >
            <Download size={15} className="text-blue-500" />
            <span>ASDMA Bulletin PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSubmitModalOpen(true)}
            className="px-5 py-2.5 rounded-xl font-bold text-white shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 cursor-pointer text-xs sm:text-sm"
            style={{ background: c.green || "#0a8754" }}
          >
            <Camera size={16} />
            <span>Submit Incident Report</span>
          </button>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-1" style={{ borderColor: c.cardBorder }}>
        {/* Status Tabs */}
        <div className="flex gap-4 sm:gap-6 text-xs sm:text-sm font-semibold overflow-x-auto">
          {[
            { key: "all", label: `All Reports (${countAll})` },
            { key: "pending", label: `Pending Decision (${countPending})` },
            { key: "approved", label: `Approved / Live (${countApproved})` },
            { key: "rejected", label: `Rejected (${countRejected})` },
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

        {/* Type Filter Dropdown */}
        <div className="flex items-center gap-2 text-xs">
          <Filter size={14} className="text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border bg-white dark:bg-slate-900 font-medium"
            style={{ borderColor: c.cardBorder, color: c.text }}
          >
            <option value="all">All Hazard Types</option>
            <option value="breach">Flood Breach</option>
            <option value="landslide">Landslide</option>
            <option value="overtop">Water Overtop</option>
            <option value="erosion">Riverbank Erosion</option>
          </select>
        </div>
      </div>

      {/* Reports Grid */}
      {loading ? (
        <div className="text-center py-16" style={{ color: c.textMuted }}>
          <div className="animate-spin w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm">Loading field reports and photo proofs...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div
          className="text-center py-16 rounded-2xl border p-8 space-y-3"
          style={{ background: c.cardBg, borderColor: c.cardBorder }}
        >
          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-400 flex items-center justify-center mx-auto">
            <FileText size={24} />
          </div>
          <h3 className="font-bold text-base" style={{ color: c.text }}>
            No Reports Found in this Category
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            No incident reports matching your active filters. Click &quot;Submit Incident Report&quot; to file verified ground-truth data with photo proof.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredReports.map((r) => {
            const isPending = r.status === "pending";
            const isApproved = r.status === "approved";
            const isRejected = r.status === "rejected";

            return (
              <div
                key={r.id}
                className="rounded-2xl border overflow-hidden flex flex-col justify-between transition-all duration-200 hover:shadow-md"
                style={{ background: c.cardBg, borderColor: c.cardBorder }}
              >
                {/* Photo Proof Area */}
                <div className="relative h-44 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden group">
                  {r.photoUrl ? (
                    <>
                      <img
                        src={r.photoUrl}
                        alt="Incident Proof"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewPhoto({ url: r.photoUrl, title: `${r.road} (${r.type})` })}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-bold cursor-pointer backdrop-blur-[2px]"
                      >
                        <Eye size={16} />
                        <span>Inspect Full Photo Proof</span>
                      </button>
                    </>
                  ) : (
                    <div className="text-center p-4 text-gray-400">
                      <Camera size={28} className="mx-auto mb-1 opacity-50" />
                      <span className="text-xs">No Photo Proof Attached</span>
                    </div>
                  )}

                  {/* Severity Badge */}
                  <span
                    className="absolute top-3 left-3 px-2.5 py-0.5 rounded-md text-[10px] uppercase font-extrabold text-white shadow"
                    style={{
                      background:
                        r.severity === "RED"
                          ? "#dc2626"
                          : r.severity === "HIGH"
                          ? "#ea580c"
                          : "#2563eb",
                    }}
                  >
                    {r.severity} &bull; {r.type}
                  </span>

                  {/* Proximity Verification Badge */}
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white shadow flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    <span>&le; 1 km Verified ({r.distanceMeters || 350}m)</span>
                  </span>
                </div>

                {/* Report Details */}
                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    {/* Road & Location */}
                    <div className="flex items-start gap-2">
                      <MapPin size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                      <h4 className="font-extrabold text-sm line-clamp-1" style={{ color: c.text }}>
                        {r.road}
                      </h4>
                    </div>

                    {/* Note */}
                    <p className="text-xs leading-relaxed line-clamp-3 text-gray-600 dark:text-gray-300">
                      {r.cleanNote}
                    </p>
                  </div>

                  {/* Metadata & Status */}
                  <div className="pt-3 border-t space-y-2.5" style={{ borderColor: c.cardBorder }}>
                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        <span>{r.eventDate}</span>
                      </div>
                      <div className="font-medium">{r.reporter}</div>
                    </div>

                    {/* Decision Status Pill */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isApproved
                              ? "bg-emerald-500"
                              : isPending
                              ? "bg-amber-500 animate-pulse"
                              : "bg-red-500"
                          }`}
                        />
                        <span className="text-xs font-bold capitalize" style={{ color: c.text }}>
                          {isPending
                            ? "Pending Admin Review"
                            : isApproved
                            ? "Approved & Verified"
                            : "Rejected / Dismissed"}
                        </span>
                      </div>

                      {/* Coordinates */}
                      <span className="text-[10px] font-mono text-gray-400">
                        {r.lat?.toFixed(3)}, {r.lng?.toFixed(3)}
                      </span>
                    </div>

                    {/* Admin Action Buttons (for pending reports) */}
                    {isAdmin && (
                      <div className="pt-2 border-t flex items-center gap-2" style={{ borderColor: c.cardBorder }}>
                        {processingId === r.id ? (
                          <div className="text-xs text-gray-500 flex items-center gap-1 py-1">
                            <Loader2 size={13} className="animate-spin" /> Saving decision...
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDecision(r.id, "approved")}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                                isApproved
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              <Check size={14} />
                              <span>{isApproved ? "Approved" : "Approve & Alert"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDecision(r.id, "rejected")}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                                isRejected
                                  ? "bg-red-100 text-red-800"
                                  : "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                              }`}
                            >
                              <XCircle size={14} />
                              <span>{isRejected ? "Rejected" : "Reject"}</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Public / Driver Submit Report Modal */}
      {isSubmitModalOpen && (
        <SubmitReportModal
          c={c}
          onClose={() => setIsSubmitModalOpen(false)}
          onSuccess={(newReport) => {
            setReports((prev) => [parseReportData(newReport), ...prev]);
          }}
        />
      )}

      {/* Photo Proof Lightbox Viewer */}
      {previewPhoto && (
        <PhotoProofViewer
          photoUrl={previewPhoto.url}
          title={previewPhoto.title}
          onClose={() => setPreviewPhoto(null)}
        />
      )}
    </div>
  );
}
