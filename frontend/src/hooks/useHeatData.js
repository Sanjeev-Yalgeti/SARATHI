import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// Severity weights per specification: RED=1.0, HIGH=0.7, MEDIUM=0.4, LOW=0.2
const SEVERITY_WEIGHTS = {
  RED: 1.0,
  HIGH: 0.7,
  MEDIUM: 0.4,
  LOW: 0.2,
};

// Coarse fixed grid coordinates covering the corridor bbox (lat 26.1–27.2, lng 91.7–94.7)
// 5 rows x 7 columns = 35 cells (well under the max 64 cells cap)
const LAT_MIN = 26.1;
const LAT_MAX = 27.2;
const LNG_MIN = 91.7;
const LNG_MAX = 94.7;
const ROWS = 5;
const COLS = 7;

const FIXED_GRID = [];
for (let r = 0; r < ROWS; r++) {
  const lat = Number(
    (LAT_MIN + (r * (LAT_MAX - LAT_MIN)) / (ROWS - 1)).toFixed(4)
  );
  for (let c = 0; c < COLS; c++) {
    const lng = Number(
      (LNG_MIN + (c * (LNG_MAX - LNG_MIN)) / (COLS - 1)).toFixed(4)
    );
    FIXED_GRID.push({ lat, lng });
  }
}

/**
 * Concurrency helper to fetch items with a pool limit
 */
async function mapConcurrent(items, fn, concurrency = 6) {
  const results = [];
  const executing = new Set();

  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    executing.add(p);

    const clean = () => executing.delete(p);
    p.then(clean, clean);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.allSettled(results);
}

/**
 * Custom hook: useHeatData
 *
 * Given (date, token, apiUrl):
 * 1. Fetches real incidents for the date: GET /api/incidents?date=YYYY-MM-DD
 * 2. Samples GET /api/risk on a coarse fixed 35-cell grid over the corridor bbox
 * 3. Converts weights (RED: 1.0, HIGH: 0.7, MEDIUM: 0.4, LOW: 0.2; risk cells: score / 100)
 * 4. Caches results in memory per date so date switches and mode toggles are instant
 * 5. Strictly adheres to server-scoping: passes logged-in user's token directly
 * 6. Never invents fake coordinates or guessed intensities
 */
export function useHeatData({
  date = "2026-07-28",
  token = null,
  apiUrl = null,
  mode = "all", // "incidents" | "all"
  enabled = true, // false = drive mode: no grid sampling, no requests
}) {
  const base =
    apiUrl ?? import.meta.env.VITE_API_URL ?? "http://localhost:5001";
  const jwt = token ?? localStorage.getItem("sarathi_token") ?? "";

  const [incidentPoints, setIncidentPoints] = useState([]);
  const [riskPoints, setRiskPoints] = useState([]);
  const [mergedPoints, setMergedPoints] = useState([]);
  const [metadata, setMetadata] = useState({
    source: "heuristic",
    baseDate: null,
    totalIncidents: 0,
    totalGridCells: 0,
    hasML: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isGridLoading, setIsGridLoading] = useState(false);

  // In-memory cache to prevent refetch storms and ensure instant toggling
  const cacheRef = useRef({});

  const headers = useMemo(() => {
    return jwt ? { Authorization: `Bearer ${jwt}` } : {};
  }, [jwt]);

  const loadDataForDate = useCallback(
    async (targetDate, abortSignal) => {
      // Drive mode: render nothing and fire no requests.
      if (!enabled) {
        setIncidentPoints([]);
        setRiskPoints([]);
        setMergedPoints([]);
        setMetadata({
          source: "heuristic",
          baseDate: null,
          totalIncidents: 0,
          totalGridCells: 0,
          hasML: false,
        });
        setIsLoading(false);
        setIsGridLoading(false);
        return;
      }
      const cacheKey = `${targetDate}_${jwt ? jwt.slice(-10) : "anon"}`;

      // Check cache first
      if (cacheRef.current[cacheKey]) {
        const cached = cacheRef.current[cacheKey];
        setIncidentPoints(cached.incidentPoints);
        setRiskPoints(cached.riskPoints);
        setMergedPoints(cached.mergedPoints);
        setMetadata(cached.metadata);
        setIsLoading(false);
        setIsGridLoading(false);
        return;
      }

      setIsLoading(true);
      setIsGridLoading(true);

      let fetchedIncidentPoints = [];
      let fetchedRiskPoints = [];
      let detectedSource = "heuristic";
      let detectedBaseDate = null;
      let hasML = false;

      // 1. Fetch real incidents for the date
      try {
        const incRes = await fetch(
          `${base}/api/incidents?date=${targetDate}`,
          {
            headers,
            signal: abortSignal,
          }
        );

        if (incRes.ok) {
          const data = await incRes.json();
          const list = data.incidents ?? [];
          fetchedIncidentPoints = list
            .filter(
              (i) =>
                Number.isFinite(Number(i.lat)) &&
                Number.isFinite(Number(i.lng))
            )
            .map((i) => {
              const weight = SEVERITY_WEIGHTS[i.severity] ?? 0.4;
              return [Number(i.lat), Number(i.lng), weight];
            });
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn("[useHeatData] Incidents fetch error:", err.message);
        }
      }

      if (abortSignal.aborted) return;

      // Update incident points immediately so UI reacts fast
      setIncidentPoints(fetchedIncidentPoints);
      setMergedPoints(fetchedIncidentPoints);
      setIsLoading(false);

      // 2. Sample risk grid over bbox
      try {
        const gridResults = await mapConcurrent(
          FIXED_GRID,
          async (cell) => {
            const res = await fetch(
              `${base}/api/risk?lat=${cell.lat}&lng=${cell.lng}&date=${targetDate}`,
              {
                headers,
                signal: abortSignal,
              }
            );
            if (!res.ok) return null;
            return await res.json();
          },
          6 // Concurrent pool of 6
        );

        if (abortSignal.aborted) return;

        gridResults.forEach((result, idx) => {
          if (result.status === "fulfilled" && result.value) {
            const data = result.value;
            const cell = FIXED_GRID[idx];
            const rawScore = Number(data.score ?? 0);
            const intensity = Math.max(0, Math.min(1, rawScore / 100));

            // Only plot cells with noticeable risk to keep heatmap clean
            if (intensity > 0.05) {
              fetchedRiskPoints.push([cell.lat, cell.lng, intensity]);
            }

            if (data.source === "ml") {
              detectedSource = "ml";
              hasML = true;
            }
            if (data.baseDate && !detectedBaseDate) {
              detectedBaseDate = data.baseDate;
            }
          }
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn("[useHeatData] Risk grid sampling error:", err.message);
        }
      }

      if (abortSignal.aborted) return;

      const combined = [...fetchedIncidentPoints, ...fetchedRiskPoints];
      const newMeta = {
        source: detectedSource,
        baseDate: detectedBaseDate,
        totalIncidents: fetchedIncidentPoints.length,
        totalGridCells: fetchedRiskPoints.length,
        hasML,
      };

      // Cache result
      cacheRef.current[cacheKey] = {
        incidentPoints: fetchedIncidentPoints,
        riskPoints: fetchedRiskPoints,
        mergedPoints: combined,
        metadata: newMeta,
      };

      setIncidentPoints(fetchedIncidentPoints);
      setRiskPoints(fetchedRiskPoints);
      setMergedPoints(combined);
      setMetadata(newMeta);
      setIsGridLoading(false);
    },
    [base, headers, jwt, enabled]
  );

  // Fetch once per date change — NEVER per-frame or in poll loop
  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- date-driven heat load (cache/network-backed, not derived render state)
    loadDataForDate(date, controller.signal);

    return () => {
      controller.abort();
    };
  }, [date, loadDataForDate]);

  // Points to render based on user mode toggle
  const activePoints = useMemo(() => {
    return mode === "incidents" ? incidentPoints : mergedPoints;
  }, [mode, incidentPoints, mergedPoints]);

  return {
    points: activePoints,
    incidentPoints,
    riskPoints,
    mergedPoints,
    metadata,
    isLoading,
    isGridLoading,
  };
}
