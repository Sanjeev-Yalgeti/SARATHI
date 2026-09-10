import axios from 'axios';
import { prisma } from './db.js';

export type WeatherSnapshot = {
  source: 'google' | 'openmeteo' | 'imd' | 'fallback';
  rainfall_mm: number;
  probability: number;
  condition?: string;
  wind_kph?: number;
  cached?: boolean;
};

const CACHE_DATE = '__weather_10min__';
const TEN_MINUTES = 10 * 60 * 1000;
const GOOGLE_URL = 'https://weather.googleapis.com/v1/currentConditions:lookup';

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function cachedSnapshot(payload: string | null): WeatherSnapshot | null {
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload) as WeatherSnapshot;
    return typeof parsed.rainfall_mm === 'number' ? { ...parsed, cached: true } : null;
  } catch {
    return null;
  }
}

async function fromGoogle(lat: number, lng: number): Promise<WeatherSnapshot> {
  const key = process.env['GOOGLE_MAPS_API_KEY'];
  if (!key || key.includes('your_')) throw new Error('Google Weather key is not configured');
  const { data } = await axios.get(GOOGLE_URL, {
    params: { key, 'location.latitude': lat, 'location.longitude': lng, unitsSystem: 'METRIC' },
    timeout: 7000,
  });
  const precipitation = data?.precipitation ?? {};
  return {
    source: 'google',
    rainfall_mm: number(precipitation?.qpf?.quantity ?? precipitation?.quantity),
    probability: Math.max(0, Math.min(1, number(precipitation?.probability?.percent) / 100)),
    condition: typeof data?.weatherCondition?.description?.text === 'string' ? data.weatherCondition.description.text : undefined,
    wind_kph: number(data?.wind?.speed?.value) || undefined,
  };
}

async function fromOpenMeteo(lat: number, lng: number): Promise<WeatherSnapshot> {
  const base = process.env['OPENMETEO_URL'] ?? 'https://api.open-meteo.com/v1/forecast';
  const { data } = await axios.get(base, {
    params: {
      latitude: lat, longitude: lng, timezone: 'auto', forecast_days: 1,
      current: 'precipitation,rain,weather_code,wind_speed_10m',
      hourly: 'precipitation_probability,precipitation',
    },
    timeout: 7000,
  });
  const hourly = data?.hourly ?? {};
  const probabilities = Array.isArray(hourly.precipitation_probability) ? hourly.precipitation_probability : [];
  return {
    source: 'openmeteo',
    rainfall_mm: number(data?.current?.rain ?? data?.current?.precipitation),
    probability: Math.max(0, Math.min(1, number(probabilities[0]) / 100)),
    condition: typeof data?.current?.weather_code === 'number' ? `WMO ${data.current.weather_code}` : undefined,
    wind_kph: number(data?.current?.wind_speed_10m) || undefined,
  };
}

async function fromImd(lat: number, lng: number): Promise<WeatherSnapshot> {
  const base = process.env['IMD_BASE_URL'];
  if (!base) throw new Error('IMD is not configured');
  const { data } = await axios.get(base, { params: { lat, lng }, timeout: 7000 });
  return { source: 'imd', rainfall_mm: number(data?.rainfall_mm), probability: number(data?.probability) };
}

/** Gets current precipitation without ever making an API caller fail. */
export async function getWeather(lat: number, lng: number): Promise<WeatherSnapshot> {
  try {
    const existing = await prisma.riskCache.findUnique({ where: { lat_lng_eventDate: { lat, lng, eventDate: CACHE_DATE } } });
    if (existing && Date.now() - existing.updatedAt.getTime() < TEN_MINUTES) {
      const cached = cachedSnapshot(existing.payload);
      if (cached) return cached;
    }
  } catch {
    // The dashboard remains usable even while a local database is being set up.
  }

  let snapshot: WeatherSnapshot;
  try {
    snapshot = await fromGoogle(lat, lng);
  } catch {
    try {
      snapshot = await fromOpenMeteo(lat, lng);
    } catch {
      try {
        snapshot = await fromImd(lat, lng);
      } catch {
        snapshot = { source: 'fallback', rainfall_mm: 0, probability: 0, condition: 'Weather service unavailable' };
      }
    }
  }

  try {
    await prisma.riskCache.upsert({
      where: { lat_lng_eventDate: { lat, lng, eventDate: CACHE_DATE } },
      create: { lat, lng, eventDate: CACHE_DATE, rainfall: snapshot.rainfall_mm, source: snapshot.source, payload: JSON.stringify(snapshot) },
      update: { rainfall: snapshot.rainfall_mm, source: snapshot.source, payload: JSON.stringify(snapshot) },
    });
  } catch {
    // Caching is an optimization, never a reason to fail weather.
  }
  return snapshot;
}
