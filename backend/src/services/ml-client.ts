// HTTP client for the disaster-ML sidecar (backend/disaster-ml/src/serve.py).
// Kept separate from risk.service.ts so the simulation loop can call the
// engine without creating a service <-> service import cycle.
import axios from 'axios';
import { isMlBand, nearestDistrict, type MlBand } from './ml-district.js';

export type MlAssessment = {
  band: MlBand;
  confidence: number;
  district: string;
  baseDate: string;
};

export type ScenarioOverrides = {
  rainfall_mm?: number;
  river_danger_level_count?: number;
};

export type MlQuery = {
  lat: number;
  lng: number;
  eventDate: string;
  rainfall_mm?: number;
  river_danger_level_count?: number;
};

/** Ask the sidecar. Returns null when unreachable/invalid -> caller falls back. */
export async function askMl(query: MlQuery, rainfall: number): Promise<MlAssessment | null> {
  const base = process.env['ML_URL'] ?? 'http://localhost:8000';
  try {
    const district = nearestDistrict(query.lat, query.lng);
    const { data } = await axios.post(`${base.replace(/\/$/, '')}/predict`, {
      district,
      date: query.eventDate,
      overrides: {
        rainfall_mm: query.rainfall_mm ?? rainfall,
        ...(query.river_danger_level_count !== undefined
          ? { river_danger_level_count: query.river_danger_level_count }
          : {}),
      },
    }, { timeout: 4500 });
    if (!isMlBand(data?.risk_level) || typeof data?.confidence !== 'number') return null;
    return {
      band: data.risk_level,
      confidence: data.confidence,
      district,
      baseDate: typeof data?.base_date === 'string' ? data.base_date : query.eventDate,
    };
  } catch { return null; }
}
