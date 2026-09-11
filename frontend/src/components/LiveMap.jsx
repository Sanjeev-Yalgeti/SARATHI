import { useEffect, useState, useRef, useMemo, useCallback, Fragment } from "react";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import {
  Radio,
  AlertTriangle,
  Truck as TruckIcon,
  Layers,
  Calendar,
  ShieldAlert,
  Info,
  Flame,
  Route as RouteIcon,
  Crosshair,
  Expand,
} from "lucide-react";
import HeatmapLayer from "./HeatmapLayer";
import { useHeatData } from "../hooks/useHeatData";

// Severity color tokens
const SEVERITY_COLORS = {
  RED: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#2563eb",
  LOW: "#16a34a",
};

// Truck status color tokens
const TRUCK_COLORS = {
  moving: "#16a34a",
  blocked: "#dc2626",
  idle: "#64748b",
};

// Offline demo data commented out per user request:
// const FALLBACK_INCIDENTS_PEAK = [ ... ];
// const FALLBACK_VEHICLES_BASE = [ ... ];

// Corridor towns (trips store origin/destination as free-text names, so resolve
// them to coordinates for GET /api/routes?from=lat,lng&to=lat,lng).
const PLACE_COORDS = [
  { match: "guwahati", label: "Guwahati", lat: 26.1844, lng: 91.7458 },
  { match: "nagaon", label: "Nagaon", lat: 26.35, lng: 92.68 },
  { match: "golaghat", label: "Golaghat", lat: 26.51, lng: 93.97 },
  { match: "sivasagar", label: "Sivasagar", lat: 26.9826, lng: 94.6426 },
  { match: "jorhat", label: "Jorhat", lat: 26.75, lng: 94.21 },
];

function resolvePlace(name) {
  // Earliest-mentioned town wins ("Sivasagar via Nagaon" → Sivasagar, not the
  // via-point), so multi-name strings resolve to the true endpoint.
  const text = String(name ?? "").toLowerCase();
  let best = null;
  let bestIdx = Infinity;
  for (const p of PLACE_COORDS) {
    const i = text.indexOf(p.match);
    if (i !== -1 && i < bestIdx) {
      best = p;
      bestIdx = i;
    }
  }
  return best;
}

// Split a route line at the truck's position: travelled part grey (like
// Google Maps), remaining part blue. Index-based split is enough for display.
function splitRouteAt(line, lat, lng) {
  if (!Array.isArray(line) || line.length < 2) return { done: [], remaining: line ?? [] };
  let bi = 0;
  let bd = Infinity;
  for (let i = 0; i < line.length; i++) {
    const d = (line[i][0] - lat) ** 2 + (line[i][1] - lng) ** 2;
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  return { done: line.slice(0, bi + 1), remaining: line.slice(bi) };
}

// Flies the map to a newly tracked truck exactly once (on selection, not on
// every 2 s poll — so the admin can still pan freely while tracking).
function FlyToTracked({ target }) {
  const map = useMap();
  const flownRef = useRef(null);
  useEffect(() => {
    if (target && flownRef.current !== target.id) {
      flownRef.current = target.id;
      map.flyTo(target.center, Math.max(map.getZoom(), 10), { duration: 1.2 });
    }
    if (!target) flownRef.current = null;
  }, [map, target]);
  return null;
}

// Continuous follow: pans to the truck every poll while active. Any manual
// drag pauses via onUserDrag (pill flips to Resume) — Google-style follow.
function FollowTracked({ truck, active, onUserDrag }) {
  const map = useMap();
  const dragRef = useRef(null);
  useEffect(() => {
    dragRef.current = onUserDrag;
  }, [onUserDrag]);
  useEffect(() => {
    const pause = () => dragRef.current?.();
    map.on("dragstart", pause);
    return () => {
      map.off("dragstart", pause);
    };
  }, [map]);
  const lat = truck?.lat;
  const lng = truck?.lng;
  useEffect(() => {
    if (active && lat != null && lng != null) {
      map.panTo([lat, lng], { animate: true });
    }
  }, [map, active, lat, lng]);
  return null;
}

// Fit-all-routes button (bottom-left, Google-style target control).
function FitRouteControl({ routes, trucks }) {
  const map = useMap();
  const flat = useMemo(() => {
    const pts = [];
    for (const r of routes ?? []) {
      for (const line of [r.primary, r.alternate]) {
        if (Array.isArray(line)) {
          for (const pt of line) pts.push(pt);
        }
      }
    }
    for (const t of trucks ?? []) {
      if (Number.isFinite(t.lat) && Number.isFinite(t.lng)) pts.push([t.lat, t.lng]);
    }
    return pts;
  }, [routes, trucks]);
  if (flat.length < 2) return null;
  return (
    <button
      type="button"
      title="Fit routes on screen"
      onClick={() => map.flyToBounds(L.latLngBounds(flat).pad(0.15), { duration: 1 })}
      className="absolute bottom-4 left-4 z-[400] w-9 h-9 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-lg flex items-center justify-center text-gray-700 dark:text-gray-200 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
    >
      <Expand size={16} />
    </button>
  );
}

// Google-style source (A, green) / destination (B, red) pins.
function endPinIcon(letter) {
  return L.divIcon({
    className: "map-pin-wrap",
    html: `<div class="map-pin ${letter === "A" ? "map-pin-a" : "map-pin-b"}"><span>${letter}</span></div>`,
    iconSize: [28, 38],
    iconAnchor: [14, 35],
  });
}
const PIN_A = endPinIcon("A");
const PIN_B = endPinIcon("B");

// Google-Maps-style pick: the alternate becomes the recommended (blue) line
// when the corridor banner reports a blockage, primary turns grey.
function pickRecommended(route, blocked) {
  const altOk = route.alternate.length > 1;
  if (blocked && altOk) {
    return { main: route.alternate, mainKind: "alternate", other: route.primary };
  }
  return { main: route.primary, mainKind: "primary", other: altOk ? route.alternate : [] };
}

export default function LiveMap({
  token,
  userRole = "ADMIN",
  currentUser = null,
  date = "2026-07-28",
  apiUrl,
  pollMs = 2000,
  showIncidents: initialShowIncidents = true,
  showBanner: initialShowBanner = true,
  showHeatmap: initialShowHeatmap = true,
  initialHeatMode = "all", // "incidents" | "all"
  theme = "light",
  height = "520px",
  onDateChange,
}) {
  const base =
    apiUrl ?? import.meta.env.VITE_API_URL ?? "http://localhost:5001";
  const jwt = token ?? localStorage.getItem("sarathi_token") ?? "";
  const isDriverRole = userRole === "DRIVER" || userRole === "restricted";

  // Drive mode = Google-clean guidance (route + truck + destination only).
  // Analyze mode = full analyst chrome (heatmap, all severities, legend).
  // Drivers are always in drive mode; admins persist their last choice.
  const [mode, setMode] = useState(() => {
    if (isDriverRole) return "drive";
    try {
      const saved = localStorage.getItem("sarathi_map_mode");
      if (saved === "analyze" || saved === "drive") return saved;
    } catch {
      /* private mode — default below */
    }
    return "drive";
  });
  useEffect(() => {
    if (isDriverRole) return;
    try {
      localStorage.setItem("sarathi_map_mode", mode);
    } catch {
      /* ignore */
    }
  }, [mode, isDriverRole]);
  const [layersOpen, setLayersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState(date);
  const [vehicles, setVehicles] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [showIncidents, setShowIncidents] = useState(initialShowIncidents);
  const [showVehicles, setShowVehicles] = useState(true);
  const [showBanner, setShowBanner] = useState(initialShowBanner);
  const [showRoutes, setShowRoutes] = useState(true);
  const [routeGeo, setRouteGeo] = useState({});
  const [showHeatmap, setShowHeatmap] = useState(
    // Drivers get a clean guidance map by default (heatmap off, toggleable).
    initialShowHeatmap && userRole !== "DRIVER" && userRole !== "restricted"
  );
  const [heatMode, setHeatMode] = useState(initialHeatMode);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Risk Heatmap data hook: analyze mode only (drive mode fires no requests).
  const heatData = useHeatData({
    date: selectedDate,
    token: jwt,
    apiUrl: base,
    mode: heatMode,
    enabled: mode === "analyze",
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const headers = useMemo(() => {
    return jwt ? { Authorization: `Bearer ${jwt}` } : {};
  }, [jwt]);

  // Keep the backend scenario clock in sync when an admin switches dates here,
  // so Live Map + Simulation page replay the same date. Best-effort: never
  // break the local date filter if the POST fails (offline / driver token).
  async function handleDateSelect(nextDate) {
    setSelectedDate(nextDate);
    if (userRole !== "ADMIN") return;
    if (!jwt || jwt.startsWith("dev_bypass_token_")) return;
    try {
      await fetch(`${base}/api/simulation/date`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ date: nextDate }),
      });
    } catch {
      /* silent — local incidents/vehicles already refetch for nextDate */
    }
  }

  // Presenter shortcut for live demos: keys 1/2/3 jump the scenario clock
  // across Onset → Peak → Relief without hunting for the buttons.
  // Admin only; ignored while typing in inputs.
  useEffect(() => {
    if (userRole === "DRIVER" || userRole === "restricted") return;
    const dates = ["2026-07-19", "2026-07-28", "2026-08-09"];
    const onKey = (e) => {
      const tag = String(e.target?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const idx = ["1", "2", "3"].indexOf(e.key);
      if (idx !== -1) void handleDateSelect(dates[idx]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleDateSelect reads latest state per press
  }, [userRole, base]);

  // 1. Vehicle Polling (every 2s per FRONTEND_HANDOFF.md §5)
  useEffect(() => {
    let timer = null;

    async function fetchVehicles() {
      try {
        const res = await fetch(`${base}/api/vehicles`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (isMountedRef.current) {
            setVehicles(data.vehicles ?? []);
            setIsLiveConnected(true);
          }
          return;
        }
      } catch {
        // Silent catch for poll retry
      }

      if (isMountedRef.current) {
        setIsLiveConnected(false);
        // setVehicles((prev) => {
        //   const list = prev.length > 0 ? prev : FALLBACK_VEHICLES_BASE;
        //   return list.map((v, i) => {
        //     if (v.status === "blocked") return v;
        //     const drift = Math.sin(Date.now() / 2000 + i) * 0.002;
        //     return {
        //       ...v,
        //       lat: v.lat + drift,
        //       lng: v.lng + (i === 1 ? 0.001 : 0.0015),
        //     };
        //   });
        // });
      }
    }

    fetchVehicles();
    timer = setInterval(fetchVehicles, pollMs);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [base, headers, pollMs]);

  // 2. Incident & Route Analysis Fetching
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      // Fetch incidents
      try {
        const res = await fetch(`${base}/api/incidents?date=${selectedDate}`, {
          headers,
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setIncidents(data.incidents ?? []);
        } else if (!res.ok && !cancelled) {
          // Offline fallback commented out per user request:
          // setIncidents(selectedDate === "2026-07-28" ? FALLBACK_INCIDENTS_PEAK : []);
          setIncidents([]);
        }
      } catch {
        if (!cancelled) {
          // Offline fallback commented out per user request:
          // setIncidents(selectedDate === "2026-07-28" ? FALLBACK_INCIDENTS_PEAK : []);
          setIncidents([]);
        }
      }

      // Fetch route analysis for Guwahati -> Sivasagar corridor
      try {
        const res = await fetch(`${base}/api/route/analyze`, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            origin: { lat: 26.1844, lng: 91.7458 },
            destination: { lat: 27.14, lng: 94.63 },
            eventDate: selectedDate,
          }),
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setAnalysis(data);
        } else if (!cancelled) {
          // Offline fallback commented out per user request:
          // setAnalysis(selectedDate === "2026-07-28" ? { ... } : null);
          setAnalysis(null);
        }
      } catch {
        if (!cancelled) {
          // Offline fallback commented out per user request:
          // setAnalysis(selectedDate === "2026-07-28" ? { ... } : null);
          setAnalysis(null);
        }
      }
    }

    loadData();
    onDateChange?.(selectedDate);

    return () => {
      cancelled = true;
    };
  }, [base, headers, selectedDate, onDateChange]);

  // Role scoping: Driver only sees their assigned vehicle
  const isDriver = isDriverRole;
  const driverVehicleId = currentUser?.id;

  const displayVehicles = useMemo(() => {
    if (!showVehicles) return [];
    if (isDriver && driverVehicleId) {
      const filtered = vehicles.filter((v) => v.vehicleId === driverVehicleId);
      return filtered.length > 0 ? filtered : vehicles.slice(0, 1);
    }
    return vehicles;
  }, [vehicles, showVehicles, isDriver, driverVehicleId]);

  const displayIncidents = !showIncidents
    ? []
    : mode === "drive"
      // Drive mode: only route-relevant severities, no pin soup.
      ? incidents.filter((i) => i.severity === "RED" || i.severity === "HIGH")
      : incidents;
  // Drivers always see the risk banner (safety-critical); only admins toggle it.
  const displayBanner = showBanner || isDriver ? analysis : null;
  // Heat renders only in analyze mode (drive mode stays Google-clean).
  const showHeat = mode === "analyze" && showHeatmap;

  // A→B route lines: one per visible truck, following its story corridor
  // (depot → via-points → destination from GET /api/vehicles) so each
  // truck's flood-hit towns show on the map. Falls back to plain
  // origin→destination when a truck carries no corridor.
  // (Drivers see only their own truck → only their own route.)
  const routePairs = useMemo(() => {
    const out = [];
    for (const v of displayVehicles) {
      const corridor =
        Array.isArray(v.corridor) && v.corridor.length >= 2 ? v.corridor : null;
      let from, to, via = [];
      if (corridor) {
        from = corridor[0];
        to = corridor[corridor.length - 1];
        via = corridor.slice(1, -1);
      } else {
        const f = resolvePlace(v.origin);
        const t = resolvePlace(v.destination);
        if (!f || !t) continue;
        from = { lat: f.lat, lng: f.lng };
        to = { lat: t.lat, lng: t.lng };
      }
      out.push({
        key: v.vehicleId,
        from: {
          lat: from.lat,
          lng: from.lng,
          label: resolvePlace(v.origin)?.label ?? v.origin,
        },
        to: {
          lat: to.lat,
          lng: to.lng,
          label: resolvePlace(v.destination)?.label ?? v.destination,
        },
        via,
        viaKey: via.map((p) => `${p.lat},${p.lng}`).join("|"),
      });
    }
    return out;
  }, [displayVehicles]);
  const routePairKeys = routePairs.map((p) => p.key).join("|");
  const fetchedRouteKeys = useRef(new Set());

  // 3. Route geometry (Google → OSRM → straight-line fallback, same as banner).
  // Geometry is date-independent, so fetch once per pair and cache.
  useEffect(() => {
    if (routePairs.length === 0) return;
    let cancelled = false;
    async function loadRoutes() {
      for (const pair of routePairs) {
        if (fetchedRouteKeys.current.has(pair.key)) continue;
        fetchedRouteKeys.current.add(pair.key);
        const viaParam = pair.viaKey ? `&via=${pair.viaKey}` : "";
        try {
          const res = await fetch(
            `${base}/api/routes?from=${pair.from.lat},${pair.from.lng}&to=${pair.to.lat},${pair.to.lng}${viaParam}`,
            { headers }
          );
          if (!res.ok) throw new Error(`route ${res.status}`);
          const data = await res.json();
          const toLatLng = (line) =>
            Array.isArray(line) ? line.map((pt) => [pt.lat, pt.lng]) : [];
          const filterValley = (line) => {
            const pts = toLatLng(line);
            if (pts.some(([lat, lng]) => (lat > 26.85 && lng < 94.0) || lat > 27.15)) return [];
            return pts;
          };
          if (!cancelled) {
            const validPrimary = filterValley(data.primary);
            const validAlternate = filterValley(data.alternate);
            const geo = {
              label: `${pair.key} · ${pair.from.label}→${pair.to.label}`,
              primary: validPrimary.length > 0 ? validPrimary : toLatLng(data.primary),
              alternate: validAlternate,
              source: data.source ?? "unknown",
              distance_km: data.distance_km ?? null,
              duration_min: data.duration_min ?? null,
            };
            setRouteGeo((prev) => (prev[pair.key] ? prev : { ...prev, [pair.key]: geo }));
          }
        } catch {
          // Offline fallback: straight corridor line so the truck's story
          // path still shows (via-points included, not just A→B).
          if (!cancelled) {
            const geo = {
              label: `${pair.key} · ${pair.from.label}→${pair.to.label}`,
              primary: [pair.from, ...pair.via, pair.to].map((p) => [p.lat, p.lng]),
              alternate: [],
              source: "fallback",
              distance_km: null,
              duration_min: null,
            };
            setRouteGeo((prev) => (prev[pair.key] ? prev : { ...prev, [pair.key]: geo }));
          }
        }
      }
    }
    loadRoutes();
    return () => {
      cancelled = true;
    };
  }, [base, headers, routePairs, routePairKeys]);

  const displayRoutes = showRoutes
    ? routePairs.map((p) => routeGeo[p.key]).filter(Boolean)
    : [];

  // Driver guidance: live GPS → destination (Google-Maps-style "which route
  // do I take"). Corridor lines above start at the depot; this one starts
  // where the truck actually is. Position is quantized to ~1 km so it only
  // refetches after real movement, not on every 2 s poll.
  const driverTruck = isDriver ? displayVehicles[0] ?? null : null;
  const driverDest = driverTruck ? resolvePlace(driverTruck.destination) : null;
  // Arrived trucks park at the destination: no guidance line (a from==to
  // route collapses to a point), just the "Arrived" strip below.
  const driverArrived = driverTruck?.status === "idle";
  const [guideGeo, setGuideGeo] = useState(null);
  const guideKey =
    driverTruck && driverDest && !driverArrived
      ? `${driverTruck.vehicleId}|${driverTruck.lat.toFixed(2)},${driverTruck.lng.toFixed(2)}→${driverDest.label}`
      : "";
  useEffect(() => {
    if (!guideKey || !driverTruck || !driverDest) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale guidance on logout/unresolvable dest
      setGuideGeo(null);
      return;
    }
    let cancelled = false;
    async function loadGuide() {
      try {
        const res = await fetch(
          `${base}/api/routes?from=${driverTruck.lat},${driverTruck.lng}&to=${driverDest.lat},${driverDest.lng}`,
          { headers }
        );
        if (!res.ok) throw new Error(`guide ${res.status}`);
        const data = await res.json();
        const toLatLng = (line) =>
          Array.isArray(line) ? line.map((pt) => [pt.lat, pt.lng]) : [];
        const filterValley = (line) => {
          const pts = toLatLng(line);
          if (pts.some(([lat, lng]) => (lat > 26.85 && lng < 94.0) || lat > 27.15)) return [];
          return pts;
        };
        if (!cancelled) {
          const validPrimary = filterValley(data.primary);
          const validAlternate = filterValley(data.alternate);
          setGuideGeo({
            label: `You→${driverDest.label}`,
            destLabel: driverDest.label,
            primary: validPrimary.length > 0 ? validPrimary : toLatLng(data.primary),
            alternate: validAlternate,
            source: data.source ?? "unknown",
            distance_km: data.distance_km ?? null,
            duration_min: data.duration_min ?? null,
          });
        }
      } catch {
        // Offline fallback: straight line from truck to destination.
        if (!cancelled) {
          setGuideGeo({
            label: `You→${driverDest.label}`,
            destLabel: driverDest.label,
            primary: [
              [driverTruck.lat, driverTruck.lng],
              [driverDest.lat, driverDest.lng],
            ],
            alternate: [],
            source: "fallback",
            distance_km: null,
            duration_min: null,
          });
        }
      }
    }
    loadGuide();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- guideKey carries position+dests
  }, [base, guideKey]);

  // Drivers see only their live guidance line; admins see corridor lines.
  // (Assembled into visibleRoutes below, after tracking is resolved.)

  // Click-to-track (admin portal): click a truck to isolate its live path.
  // Everything else dims so the tracked corridor is the only thing on screen.
  const [trackedId, setTrackedId] = useState(null);
  const [following, setFollowing] = useState(false);
  const stopUserDrag = useCallback(() => setFollowing(false), []);
  const trackedTruck = trackedId
    ? displayVehicles.find((v) => v.vehicleId === trackedId) ?? null
    : null;
  const trackedPair = useMemo(() => {
    if (!trackedTruck) return null;
    return routePairs.find((p) => p.key === trackedTruck.vehicleId) ?? null;
  }, [trackedTruck, routePairs]);
  const trackedGeo = (() => {
    if (!trackedTruck) return null;
    if (isDriver && guideGeo && trackedTruck.vehicleId === driverTruck?.vehicleId) return guideGeo;
    if (!trackedPair) return null;
    return routeGeo[trackedPair.key] ?? null;
  })();

  // Live backend path: while a truck runs a backend-known detour, draw THAT
  // line in GREEN — Google would route straight back through the RED zone it
  // just left, so its primary/alternate are demoted to grey context. Green =
  // safe passage delivered by the product: bypass-tested, actually driven.
  const pathTarget = isDriver ? driverTruck : trackedTruck;
  const [livePath, setLivePath] = useState(null);
  const livePathKey =
    pathTarget?.diverted && pathTarget?.status !== "idle"
      ? `${pathTarget.vehicleId}|${pathTarget.lat.toFixed(2)},${pathTarget.lng.toFixed(2)}`
      : "";
  useEffect(() => {
    if (!livePathKey || !pathTarget) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale detour line when trip ends
      setLivePath(null);
      return;
    }
    let cancelled = false;
    async function loadPath() {
      try {
        const res = await fetch(`${base}/api/simulation/path/${pathTarget.vehicleId}`, {
          headers,
        });
        if (!res.ok) throw new Error(`path ${res.status}`);
        const data = await res.json();
        const line = Array.isArray(data.remaining)
          ? data.remaining.map((pt) => [pt.lat, pt.lng])
          : [];
        if (!cancelled) {
          setLivePath(
            line.length > 1
              ? { vehicleId: data.vehicleId, line, clears: data.cleared ?? null }
              : null
          );
        }
      } catch {
        if (!cancelled) setLivePath(null);
      }
    }
    loadPath();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- livePathKey carries id+position
  }, [base, livePathKey]);

  // Named proof for the green line: the exact RED incident this detour was
  // proven against (road name preferred, id always honest).
  const clearsText =
    livePath?.clears?.road || livePath?.clears?.id
      ? `Clears ${livePath.clears.road ?? livePath.clears.id}`
      : "Clears the reported RED zone";

  // Detour view: GREEN = live backend line, grey = the abandoned Google road.
  const liveForTracked =
    livePath && trackedTruck && livePath.vehicleId === trackedTruck.vehicleId;
  const liveForDriver =
    livePath && isDriver && driverTruck && livePath.vehicleId === driverTruck.vehicleId;
  const abandonedLine =
    (liveForDriver ? guideGeo?.primary : liveForTracked ? trackedGeo?.primary : null) ?? [];
  const detourRoute = livePath
    ? {
        label: `${livePath.vehicleId} · SARATHI detour`,
        primary: livePath.line,
        alternate: [],
        abandoned: abandonedLine,
        source: "sim",
        distance_km: null,
        duration_min: null,
        live: true,
      }
    : null;
  const visibleRoutes = trackedId
    ? [liveForTracked ? detourRoute : trackedGeo].filter(Boolean)
    : isDriver
      ? [liveForDriver ? detourRoute : guideGeo].filter(Boolean)
      : displayRoutes;
  // A/B pins: the tracked truck gets its own pair; untracked view shows one
  // pin per unique place (all trucks share the Guwahati depot, so five
  // stacked A pins would be one misleading blob).
  const visiblePins = useMemo(() => {
    const pairs = trackedId ? (trackedPair ? [trackedPair] : []) : routePairs;
    const pins = [];
    for (const p of pairs) {
      pins.push(
        { key: `A:${p.key}`, kind: "A", lat: p.from.lat, lng: p.from.lng, label: p.from.label },
        { key: `B:${p.key}`, kind: "B", lat: p.to.lat, lng: p.to.lng, label: p.to.label }
      );
    }
    if (trackedId) return pins;
    const seen = new Set();
    return pins.filter((pin) => {
      const k = `${pin.kind}:${pin.label}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [trackedId, trackedPair, routePairs]);
  const splitTarget = trackedTruck ?? (isDriver ? driverTruck : null);
  // Fly-to point captured at selection time (not per poll).
  const flyTarget = useMemo(
    () =>
      trackedTruck
        ? { id: trackedId, center: [trackedTruck.lat, trackedTruck.lng] }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fly once per selection
    [trackedId]
  );

  // Tile layers: Carto Voyager family in both themes (cleaner than OSM
  // Standard, no key needed) — one visual language like Google Maps.
  const tileUrl =
    theme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  const tileAttribution =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

  return (
    <div className="flex flex-col gap-3 font-sans w-full">
      {/* Top Map Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-gray-200 dark:border-slate-800 shadow-sm relative">
        {/* Scenario Date Switcher */}
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <Calendar size={16} className="text-[#0a8754] shrink-0" />
          <span className="font-bold text-gray-700 dark:text-gray-300" title={isDriver ? undefined : "Presenter shortcut: press 1 / 2 / 3"}>
            {isDriver ? "View date:" : "Scenario Date:"}
          </span>
          <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg">
            {[
              { date: "2026-07-19", label: "19 Jul (Onset)" },
              { date: "2026-07-28", label: "28 Jul (Peak)" },
              { date: "2026-08-09", label: "09 Aug (Relief)" },
            ].map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => handleDateSelect(d.date)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  selectedDate === d.date
                    ? "bg-[#0a8754] text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Drive / Analyze mode (admins only — drivers are always drive) */}
        {!isDriver && (
          <div
            className="flex items-center bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg"
            role="tablist"
            aria-label="Map mode"
          >
            {[
              { key: "drive", label: "Drive" },
              { key: "analyze", label: "Analyze" },
            ].map((m) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={mode === m.key}
                onClick={() => setMode(m.key)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  mode === m.key
                    ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* View Layer Toggles & Live Status Indicator */}
        <div className="flex items-center gap-2.5 flex-wrap text-xs">
          <div className="relative">
            <button
              type="button"
              onClick={() => setLayersOpen((o) => !o)}
              aria-expanded={layersOpen}
              className={`flex w-full items-center justify-start gap-1.5 px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-colors ${
                layersOpen
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-transparent"
              }`}
              title="Map layers"
            >
              <Layers size={13} />
              <span>Layers</span>
            </button>
            {layersOpen && (
            <div className="absolute right-0 top-full mt-2 z-[500] w-60 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl flex flex-col items-stretch gap-1.5">
          {/* Incidents Toggle */}
          <button
            type="button"
            onClick={() => setShowIncidents(!showIncidents)}
            className={`flex w-full items-center justify-start gap-1.5 px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-colors ${
              showIncidents
                ? "bg-red-50 dark:bg-red-950/30 text-red-600 border-red-200 dark:border-red-900"
                : "bg-gray-100 dark:bg-slate-800 text-gray-500 border-transparent"
            }`}
          >
            <AlertTriangle size={13} />
            <span>Incidents ({displayIncidents.length})</span>
          </button>

          {/* Trucks Toggle */}
          <button
            type="button"
            onClick={() => setShowVehicles(!showVehicles)}
            className={`flex w-full items-center justify-start gap-1.5 px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-colors ${
              showVehicles
                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 border-emerald-200 dark:border-emerald-900"
                : "bg-gray-100 dark:bg-slate-800 text-gray-500 border-transparent"
            }`}
          >
            <TruckIcon size={13} />
            <span>Fleet ({displayVehicles.length})</span>
          </button>

          {/* Routes Toggle */}
          <button
            type="button"
            onClick={() => setShowRoutes(!showRoutes)}
            className={`flex w-full items-center justify-start gap-1.5 px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-colors ${
              showRoutes
                ? "bg-sky-50 dark:bg-sky-950/30 text-sky-700 border-sky-200 dark:border-sky-900"
                : "bg-gray-100 dark:bg-slate-800 text-gray-500 border-transparent"
            }`}
            title="Toggle A→B route lines (primary + alternate)"
          >
            <RouteIcon size={13} />
            <span>Routes ({visibleRoutes.length})</span>
          </button>
          {/* Banner Toggle (admin only — drivers always see it) */}
          {!isDriver && (
          <button
            type="button"
            onClick={() => setShowBanner(!showBanner)}
            className={`flex w-full items-center justify-start gap-1.5 px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-colors ${
              showBanner
                ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 border-amber-200 dark:border-amber-900"
                : "bg-gray-100 dark:bg-slate-800 text-gray-500 border-transparent"
            }`}
          >
            <Layers size={13} />
            <span>Risk Banner</span>
          </button>
          )}

          {/* Heatmap Layer Toggle (admin only — off by default for drivers) */}
          {!isDriver && (
          <>
          <button
            type="button"
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex w-full items-center justify-start gap-1.5 px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-colors ${
              showHeatmap
                ? "bg-orange-50 dark:bg-orange-950/30 text-orange-600 border-orange-200 dark:border-orange-900 shadow-xs"
                : "bg-gray-100 dark:bg-slate-800 text-gray-500 border-transparent"
            }`}
            title="Toggle risk heatmap overlay"
          >
            <Flame
              size={13}
              className={showHeatmap ? "text-orange-500 fill-orange-500" : ""}
            />
            <span>Heatmap ({heatData.points.length})</span>
          </button>

          {/* Heatmap Mode Selector (Incidents Only vs Incidents + Risk Grid) */}
          {showHeatmap && (
            <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg border border-gray-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setHeatMode("incidents")}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                  heatMode === "incidents"
                    ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
                title="Heatmap from confirmed incidents only"
              >
                Incidents Only
              </button>
              <button
                type="button"
                onClick={() => setHeatMode("all")}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer flex items-center gap-1 ${
                  heatMode === "all"
                    ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
                title="Heatmap from confirmed incidents + sampled corridor risk grid (35 cells)"
              >
                <span>Incidents + Risk Grid</span>
                {heatData.isGridLoading && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                )}
              </button>
            </div>
          )}
          </>
          )}
            </div>
          )}
          </div>

          {/* Live Polling Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
              isLiveConnected
                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
            }`}
          >
            <Radio
              size={12}
              className={isLiveConnected ? "animate-pulse text-green-600" : ""}
            />
            <span>{isLiveConnected ? "LIVE (2s)" : "SIMULATED (2s)"}</span>
          </div>
        </div>
      </div>

      {/* Corridor Risk Alert Banner (POST /api/route/analyze) */}
      {displayBanner?.blocked && (
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 text-red-900 shadow-sm animate-fadeIn text-xs dark:bg-red-950/40 dark:border-red-900 dark:text-red-200">
          <div className="p-1 rounded-md bg-red-600 text-white shrink-0">
            <ShieldAlert size={15} />
          </div>
          <p className="flex-1 leading-snug">
            <span className="font-extrabold">RED RISK ALERT — corridor impassable. </span>
            <span className="opacity-90">{displayBanner.delayMessage} </span>
            {displayBanner.recommendedRoad && (
              <span className="font-semibold">🧭 {displayBanner.recommendedRoad}</span>
            )}
          </p>
        </div>
      )}

      {/* Driver guidance strip — "which route do I take" at a glance */}
      {isDriver && showRoutes && (guideGeo || liveForDriver || (driverArrived && driverDest)) && (
        <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border shadow-sm text-sm ${liveForDriver ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200" : "border-sky-200 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:border-sky-900 dark:text-sky-200"}`}>
          <div className={`p-1.5 rounded-lg text-white shrink-0 ${liveForDriver ? "bg-[#16a34a]" : "bg-[#1a73e8]"}`}>
            <RouteIcon size={16} />
          </div>
          <div className="flex-1 leading-snug">
            {guideGeo || liveForDriver ? (
              <>
                <span className="font-extrabold">
                  {liveForDriver
                    ? `On SARATHI detour → ${guideGeo?.destLabel ?? driverDest?.label ?? ""}`
                    : `Your route → ${guideGeo.destLabel}`}
                </span>
                {guideGeo?.distance_km != null && !liveForDriver && (
                  <span> · {guideGeo.distance_km} km · ~{guideGeo.duration_min} min</span>
                )}
                <span className="block text-xs opacity-80">
                  {liveForDriver
                    ? `Follow the green line — ${clearsText}. Grey is the abandoned road.`
                    : displayBanner?.blocked
                      ? "Primary blocked — follow the blue detour."
                      : "Follow the blue line."}{" "}
                  {!liveForDriver && `(via ${guideGeo.source})`}
                </span>
              </>
            ) : (
              <>
                <span className="font-extrabold">Delivered ✓ {driverDest.label}</span>
                <span className="block text-xs opacity-80">
                  Trip complete — press Start Simulation to replay it for the judges.
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Leaflet Map Frame */}
      <div
        style={{ height, minHeight: 440 }}
        className="relative w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-800 shadow-lg z-0"
      >
        {/* Tracking pill — floats on the map, never stacks panels below it */}
        {trackedId && (
          <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 text-white shadow-lg text-xs font-bold backdrop-blur-sm">
            <Crosshair size={13} className="animate-pulse text-sky-400" />
            <span>
              {trackedId}
              {trackedTruck?.diverted ? " • detour" : ""}
            </span>
            <button
              type="button"
              title={following ? "Following — drag the map to pause" : "Follow this truck"}
              onClick={() => setFollowing((f) => !f)}
              className={`px-2 py-0.5 rounded-full cursor-pointer ${
                following ? "bg-sky-500 text-white" : "bg-white/15 hover:bg-white/25"
              }`}
            >
              {following ? "Following" : "Follow"}
            </button>
            <button
              type="button"
              onClick={() => {
                setTrackedId(null);
                setFollowing(false);
              }}
              className="px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 cursor-pointer"
            >
              Show all
            </button>
          </div>
        )}
        <MapContainer
          center={[26.45, 93.1]}
          zoom={8}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution={tileAttribution}
            url={tileUrl}
          />
          <FlyToTracked target={flyTarget} />
          <FollowTracked truck={trackedTruck} active={following && !!trackedTruck} onUserDrag={stopUserDrag} />
          <FitRouteControl routes={visibleRoutes} trucks={displayVehicles} />

          {/* Risk Heatmap Layer (analyze mode only, underneath markers) */}
          {showHeat && (
            <HeatmapLayer
              points={heatData.points}
              radius={25}
              blur={20}
              minOpacity={0.4}
              gradient={{
                0.2: "#16a34a", // LOW (green)
                0.4: "#eab308", // MEDIUM (yellow)
                0.7: "#ea580c", // HIGH (orange)
                1.0: "#dc2626", // RED (red)
              }}
              max={1.0}
            />
          )}

          {/* A→B Route Lines — Google-style: remaining blue w/ white casing,
              travelled grey, alternative grey. Alternate wins on blockage.
              Click-to-track isolates the tracked truck's path. A live
              backend detour always wins: GREEN = safe passage actually
              being driven (bypass-tested), grey = abandoned Google road. */}
          {visibleRoutes.map((r) => {
            const { main, mainKind, other } = r.live
              ? { main: r.primary, mainKind: "detour", other: r.abandoned ?? [] }
              : pickRecommended(r, displayBanner?.blocked);
            const isLiveDetour = mainKind === "detour" && r.live;
            const mainColor = isLiveDetour ? "#16a34a" : "#1a73e8";
            const info =
              `${r.label}` +
              (r.distance_km != null ? ` · ${r.distance_km} km` : "") +
              (r.duration_min != null ? ` · ~${r.duration_min} min` : "") +
              ` (${r.source})`;
            // Grey out the part behind the tracked/driving truck.
            const split =
              splitTarget && main.length > 1
                ? splitRouteAt(main, splitTarget.lat, splitTarget.lng)
                : { done: [], remaining: main };
            return (
              <Fragment key={r.label}>
                {other.length > 1 && (
                  <Polyline
                    positions={other}
                    pathOptions={{ color: "#9aa0a6", weight: 4, opacity: 0.8 }}
                  >
                    <Tooltip sticky>
                      <span className="font-bold">Alternative</span> &bull; {info}
                    </Tooltip>
                  </Polyline>
                )}
                {split.done.length > 1 && (
                  <Polyline
                    positions={split.done}
                    pathOptions={{ color: "#9aa0a6", weight: 3, opacity: 0.7 }}
                  >
                    <Tooltip sticky>
                      <span className="font-bold">Travelled</span> &bull; {info}
                    </Tooltip>
                  </Polyline>
                )}
                {split.remaining.length > 1 && (
                  <Polyline
                    positions={split.remaining}
                    pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.9, interactive: false }}
                  />
                )}
                {split.remaining.length > 1 && (
                  <Polyline
                    positions={split.remaining}
                    pathOptions={{ color: mainColor, weight: 5, opacity: 1 }}
                  >
                    <Tooltip sticky>
                      <span className="font-bold">
                        {isLiveDetour
                          ? "SARATHI detour"
                          : mainKind === "alternate"
                            ? "Recommended (detour)"
                            : "Recommended"}
                      </span>{" "}
                      &bull; {isLiveDetour ? clearsText : info}
                    </Tooltip>
                  </Polyline>
                )}
              </Fragment>
            );
          })}

          {/* Google-style source (A) / destination (B) pins per route */}
          {showRoutes &&
            visiblePins.map((pin) => (
              <Marker
                key={pin.key}
                position={[pin.lat, pin.lng]}
                icon={pin.kind === "A" ? PIN_A : PIN_B}
              >
                <Tooltip direction="top" offset={[0, -20]} opacity={0.95}>
                  <span className="font-bold">
                    {pin.kind === "A" ? "Source:" : "Destination:"}
                  </span>{" "}
                  {pin.label}
                </Tooltip>
              </Marker>
            ))}

          {/* Vehicle Markers — click to track a truck's live path */}
          {displayVehicles.map((v) => {
            const isBlocked = v.status === "blocked";
            const color = TRUCK_COLORS[v.status] ?? "#64748b";
            const isTracked = trackedId === v.vehicleId;
            const dimmed = trackedId && !isTracked;

            return (
              <CircleMarker
                key={v.vehicleId}
                center={[v.lat, v.lng]}
                radius={isTracked ? 11 : isBlocked ? 10 : 8}
                pathOptions={{
                  color: isTracked ? "#1a73e8" : color,
                  fillColor: isTracked ? "#1a73e8" : color,
                  fillOpacity: dimmed ? 0.3 : 0.9,
                  opacity: dimmed ? 0.4 : 1,
                  weight: isTracked ? 3.5 : 2.5,
                }}
                eventHandlers={{
                  click: () => {
                    if (trackedId === v.vehicleId) {
                      setTrackedId(null);
                      setFollowing(false);
                    } else {
                      setTrackedId(v.vehicleId);
                      setFollowing(true);
                    }
                  },
                }}
              >
                <Tooltip
                  direction="top"
                  offset={[0, -12]}
                  opacity={dimmed ? 0.6 : 1}
                  permanent
                  className="truck-label"
                >
                  {v.vehicleId}{v.diverted ? " • detour" : ""}
                </Tooltip>
                <Popup>
                  <div className="text-xs p-1">
                    <div className="flex items-center justify-between gap-2 border-b pb-1 mb-1.5 font-bold">
                      <span className="text-sm font-extrabold text-gray-900">
                        {v.vehicleId}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-white"
                        style={{ background: color }}
                      >
                        {v.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-gray-700">
                      <div>
                        <b>Cargo:</b> {v.cargoType}
                      </div>
                      <div>
                        <b>Route:</b> {v.origin} &rarr; {v.destination}
                        {v.diverted && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-white bg-sky-600">
                            detour
                          </span>
                        )}
                      </div>
                      <div>
                        <b>Speed:</b> {v.speed} km/h
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        GPS: {v.lat.toFixed(4)}, {v.lng.toFixed(4)}
                      </div>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* Incident Markers */}
          {displayIncidents.map((inc) => {
            const color = SEVERITY_COLORS[inc.severity] ?? "#dc2626";

            return (
              <CircleMarker
                key={inc.id}
                center={[inc.lat, inc.lng]}
                radius={inc.severity === "RED" ? 8 : 6}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.85,
                  weight: 2,
                }}
              >
                <Tooltip direction="bottom" offset={[0, 8]} opacity={0.95}>
                  <b>[{inc.severity}]</b> {inc.type} &bull; {inc.road}
                </Tooltip>
                <Popup>
                  <div className="text-xs p-1 max-w-[240px]">
                    <div className="flex items-center justify-between border-b pb-1 mb-1.5">
                      <span className="font-bold text-gray-900 capitalize">
                        {inc.type} Incident
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] uppercase font-extrabold text-white"
                        style={{ background: color }}
                      >
                        {inc.severity}
                      </span>
                    </div>
                    <div className="space-y-1 text-gray-700">
                      <div>
                        <b>Road:</b> {inc.road || "Not recorded"}
                      </div>
                      <div>
                        <b>District:</b> {inc.district || "NER"}
                      </div>
                      <div>
                        <b>Date:</b> {inc.eventDate}
                      </div>
                      {inc.note && (
                        <div className="mt-1.5 p-1.5 bg-gray-50 rounded border text-[11px] italic text-gray-600">
                          {inc.note}
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Map legend — collapsed behind an ⓘ button (Google-style minimal
            chrome; heat detail lives inside when the heat layer is on) */}
        <div className="absolute bottom-4 right-4 z-[400] flex flex-col items-end gap-2 pointer-events-none">
          <button
            type="button"
            onClick={() => setLegendOpen((o) => !o)}
            aria-expanded={legendOpen}
            title="Map legend"
            className="pointer-events-auto w-9 h-9 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-lg flex items-center justify-center text-gray-600 dark:text-gray-300 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
          >
            <Info size={16} />
          </button>
          {legendOpen && (
          <div className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-gray-200 dark:border-slate-800 shadow-md text-xs max-w-[280px]">
          <div className="font-bold mb-2 flex items-center justify-between gap-1 text-gray-800 dark:text-gray-200">
            <div className="flex items-center gap-1">
              <Info size={13} />
              <span>Map Legend</span>
            </div>
            {showHeat && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 font-semibold">
                Heat Active
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a]" />
              <span>Moving Truck</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" />
              <span>Blocked Truck</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" />
              <span>RED Incident</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ea580c]" />
              <span>HIGH Risk</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-1 rounded-full bg-[#1a73e8]" />
              <span>Recommended Route</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-1 rounded-full bg-[#16a34a]" />
              <span>Safe Detour (SARATHI)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-1 rounded-full bg-[#9aa0a6]" />
              <span>Alternative</span>
            </div>
          </div>

          {/* Heatmap Risk Gradient Chips & Transparency Info Line */}
          {showHeat && (
            <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-slate-800">
              <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center justify-between">
                <span>HEATMAP RISK LEVEL</span>
                <span className="font-mono text-[9px] text-gray-400">0.0 &rarr; 1.0</span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center text-[9px] font-bold">
                <span className="px-1 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  LOW
                </span>
                <span className="px-1 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-800">
                  MED
                </span>
                <span className="px-1 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-300 dark:border-orange-800">
                  HIGH
                </span>
                <span className="px-1 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-300 dark:border-red-800">
                  RED
                </span>
              </div>

              {/* Transparency / Model Source Line */}
              <div className="mt-2 pt-1.5 border-t border-dashed border-gray-200 dark:border-slate-800 text-[10px] text-gray-500 dark:text-gray-400 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Model Source:</span>
                  <span
                    className={`font-semibold uppercase text-[9px] px-1.5 py-0.2 rounded ${
                      heatData.metadata.source === "ml"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-bold"
                        : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300 font-mono"
                    }`}
                  >
                    {heatData.metadata.source === "ml" ? "Disaster-ML" : "Heuristic"}
                  </span>
                </div>
                {heatData.metadata.baseDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Base Date:</span>
                    <span className="font-mono text-[9px] text-gray-700 dark:text-gray-300">
                      {heatData.metadata.baseDate}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[9px] text-gray-400">
                  <span>Coverage:</span>
                  <span>
                    {heatData.points.length} pts ({heatMode === "incidents" ? "Incidents" : "Incidents + Grid"})
                  </span>
                </div>
              </div>
            </div>
          )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
