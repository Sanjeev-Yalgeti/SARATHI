import { prisma } from './db.js';
import { mlBandToScore } from './ml-district.js';
import type { MlBand } from './ml-district.js';
import { askMl } from './ml-client.js';
import { clamp, levelFor, type RiskLevel } from './risk.level.js';
import { haversineKm } from './simulation.service.js';
import { getWeather } from './weather.service.js';

export { clamp, levelFor, type RiskLevel };

export type RiskResult = {
  landslide_prob: number;
  score: number;
  level: RiskLevel;
  reasons: string[];
  source: 'ml' | 'heuristic';
  rainfall_mm: number;
  // Present only when the disaster-ML sidecar answered.
  district?: string;
  mlBand?: MlBand;
  baseDate?: string;
  mlConfidence?: number;
};

type RiskInput = { lat: number; lng: number; eventDate: string; slope_gradient?: number; forestation_level?: number; road_cut?: number; flood_zone?: number; rainfall_mm?: number; river_danger_level_count?: number };

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
    const mapped = mlBandToScore(ml.band);
    score = mapped.score;
    probability = clamp(score / 100);
    source = 'ml';
    reasons.push(
      `Disaster-ML assessment for ${ml.district} on ${input.eventDate}: ${ml.band} band ` +
      `(${(ml.confidence * 100).toFixed(1)}% confidence).`
    );
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
  const result: RiskResult = {
    landslide_prob: Number(probability.toFixed(2)), score, level: levelFor(score), reasons, source, rainfall_mm: weather.rainfall_mm,
    ...(ml ? { district: ml.district, mlBand: ml.band, baseDate: ml.baseDate, mlConfidence: ml.confidence } : {}),
  };
  await prisma.riskCache.upsert({
    where: { lat_lng_eventDate: { lat: input.lat, lng: input.lng, eventDate: input.eventDate } },
    create: { lat: input.lat, lng: input.lng, eventDate: input.eventDate, score: result.score, level: result.level, rainfall: result.rainfall_mm, probability: result.landslide_prob, source: result.source, payload: JSON.stringify(result) },
    update: { score: result.score, level: result.level, rainfall: result.rainfall_mm, probability: result.landslide_prob, source: result.source, payload: JSON.stringify(result) },
  });
  return result;
}
