import axios from 'axios';
import { prisma } from './db.js';
import { haversineKm } from './simulation.service.js';
import { getWeather } from './weather.service.js';

export type RiskResult = {
  landslide_prob: number;
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'RED';
  reasons: string[];
  source: 'ml' | 'heuristic';
  rainfall_mm: number;
};

type RiskInput = { lat: number; lng: number; eventDate: string; slope_gradient?: number; forestation_level?: number; road_cut?: number; flood_zone?: number };

function clamp(value: number): number { return Math.max(0, Math.min(1, value)); }
function levelFor(score: number): RiskResult['level'] {
  if (score >= 75) return 'RED';
  if (score >= 55) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

async function askMl(input: RiskInput, rainfall: number): Promise<{ probability: number; score?: number } | null> {
  const base = process.env['ML_URL'] ?? 'http://localhost:8000';
  try {
    const { data } = await axios.post(`${base.replace(/\/$/, '')}/predict`, {
      ...input, rainfall_24h: rainfall, rainfall_3d: rainfall * 2.4,
      slope_gradient: input.slope_gradient ?? 18, forestation_level: input.forestation_level ?? 0.55,
      elevation: 160, lithology: 'alluvial', dist_to_river: 2, road_cut: input.road_cut ?? 1, susceptibility: 'medium',
    }, { timeout: 4500 });
    const probability = Number(data?.landslide_prob ?? data?.probability ?? data?.confidence);
    return Number.isFinite(probability) ? { probability: clamp(probability), score: Number(data?.score) || undefined } : null;
  } catch { return null; }
}

/** ML-first landslide assessment; a transparent local model is the offline fallback. */
export async function predictRisk(input: RiskInput): Promise<RiskResult> {
  const weather = await getWeather(input.lat, input.lng);
  const nearby = await prisma.incident.findMany({ where: { eventDate: input.eventDate } });
  const closeIncidents = nearby.filter((incident) => haversineKm(input.lat, input.lng, incident.lat, incident.lng) <= 35);
  const ml = await askMl(input, weather.rainfall_mm);
  const reasons: string[] = [];
  let probability: number;
  let score: number;
  let source: RiskResult['source'];

  if (ml) {
    probability = ml.probability;
    score = Math.round(ml.score ?? probability * 100);
    source = 'ml';
    reasons.push('Dhruv ML assessment based on terrain, vegetation and rainfall.');
  } else {
    const rainFactor = clamp(weather.rainfall_mm / 100);
    const roadFactor = input.road_cut ?? 0.7;
    const floodFactor = input.flood_zone ?? (input.eventDate === '2026-07-28' ? 1 : 0.15);
    probability = clamp(0.5 * rainFactor + 0.3 * roadFactor + 0.2 * floodFactor);
    score = Math.round(probability * 100);
    source = 'heuristic';
    reasons.push('Offline weighted model: rainfall, road-cut exposure and flood-zone conditions.');
  }
  if (weather.rainfall_mm > 0) reasons.push(`${weather.rainfall_mm.toFixed(1)} mm current rainfall from ${weather.source}.`);
  if (closeIncidents.length > 0) {
    probability = Math.max(probability, 0.85);
    score = Math.max(score, 85);
    reasons.push(`${closeIncidents.length} active incident(s) within 35 km on this scenario date.`);
  }
  if (input.eventDate === '2026-07-28') reasons.push('Peak-flood scenario date: elevated landslide susceptibility.');
  const result: RiskResult = { landslide_prob: Number(probability.toFixed(2)), score, level: levelFor(score), reasons, source, rainfall_mm: weather.rainfall_mm };
  await prisma.riskCache.upsert({
    where: { lat_lng_eventDate: { lat: input.lat, lng: input.lng, eventDate: input.eventDate } },
    create: { lat: input.lat, lng: input.lng, eventDate: input.eventDate, score: result.score, level: result.level, rainfall: result.rainfall_mm, probability: result.landslide_prob, source: result.source, payload: JSON.stringify(result) },
    update: { score: result.score, level: result.level, rainfall: result.rainfall_mm, probability: result.landslide_prob, source: result.source, payload: JSON.stringify(result) },
  });
  return result;
}
