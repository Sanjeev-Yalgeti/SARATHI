/**
 * scripts/geocode-incidents.ts
 * Google-only lat/lng fetch for real PDF road names (TEST_CASES subset).
 *
 * SAFETY CONTRACT (real-data-only):
 * - Reads:  data/geocode.targets.json (road list YOU approved in scope)
 * - Writes: data/geocode.staging.json (hits for YOUR review)
 *           data/geocode.missing.json (roads with no usable hit — skipped, never invented)
 * - NEVER writes: data/incidents.json, the database, or any seed file.
 *   Merging staged rows into incidents.json is a separate, manual approval step.
 *
 * Run:  npm run geocode:incidents
 * Needs GOOGLE_MAPS_API_KEY in backend/.env (you said you will add it later).
 */
import 'dotenv/config';
import axios from 'axios';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');

// NER operating box — same as POST /api/reports validation.
const LAT_MIN = 21;
const LAT_MAX = 30;
const LNG_MIN = 89;
const LNG_MAX = 98;

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const PAUSE_MS = 300;

interface Target {
  key: string;
  label: string;
  district: string;
  eventDate: string;
  type: string;
  sourcePdf: string;
  testCase: string;
  query: string;
  expectPdfGps: boolean;
  note: string;
}

interface StagedHit extends Target {
  lat: number;
  lng: number;
  coordSource: 'geocoded-approx';
  needsPdfGps: boolean;
  formattedAddress: string;
}

interface MissingEntry extends Target {
  reason: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inBox(lat: number, lng: number): boolean {
  return lat >= LAT_MIN && lat <= LAT_MAX && lng >= LNG_MIN && lng <= LNG_MAX;
}

async function main(): Promise<void> {
  const key = process.env['GOOGLE_MAPS_API_KEY'];
  if (!key || key.trim() === '' || key.includes('your_') || key.includes('change-me')) {
    console.error(
      'Missing GOOGLE_MAPS_API_KEY.\n' +
        'Add your key to backend/.env, e.g.:\n' +
        '  GOOGLE_MAPS_API_KEY=AIza...\n' +
        'Then re-run: npm run geocode:incidents\n' +
        'Nothing was read, written, or changed.'
    );
    process.exit(1);
  }

  const targetsRaw = await readFile(join(DATA_DIR, 'geocode.targets.json'), 'utf8');
  const targets = JSON.parse(targetsRaw) as Target[];
  console.log(`Geocoding ${targets.length} target(s) via Google (one request each)...`);

  const staged: StagedHit[] = [];
  const missing: MissingEntry[] = [];

  for (const target of targets) {
    try {
      const { data } = await axios.get(GEOCODE_URL, {
        params: { address: target.query, key },
        timeout: 10000,
      });
      const status = data?.status as string | undefined;
      const first = data?.results?.[0] as
        | { geometry?: { location?: { lat?: number; lng?: number } }; formatted_address?: string }
        | undefined;
      const lat = Number(first?.geometry?.location?.lat);
      const lng = Number(first?.geometry?.location?.lng);

      if (status !== 'OK' || !first || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        missing.push({ ...target, reason: `Google status: ${status ?? 'no response'}` });
        console.log(`  MISS  ${target.key} — ${status ?? 'no response'}`);
      } else if (!inBox(lat, lng)) {
        missing.push({ ...target, reason: `Hit outside NER box: ${lat},${lng}` });
        console.log(`  MISS  ${target.key} — outside NER box (${lat},${lng})`);
      } else {
        staged.push({
          ...target,
          lat,
          lng,
          coordSource: 'geocoded-approx',
          needsPdfGps: target.expectPdfGps,
          formattedAddress:
            typeof first.formatted_address === 'string' ? first.formatted_address : '',
        });
        console.log(`  HIT   ${target.key} — ${lat},${lng}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'request failed';
      missing.push({ ...target, reason: message });
      console.log(`  MISS  ${target.key} — ${message}`);
    }
    await sleep(PAUSE_MS);
  }

  await writeFile(join(DATA_DIR, 'geocode.staging.json'), JSON.stringify(staged, null, 2) + '\n');
  await writeFile(join(DATA_DIR, 'geocode.missing.json'), JSON.stringify(missing, null, 2) + '\n');

  console.log('\nDone. Review BEFORE anything enters the seed:');
  console.log(`  staged : data/geocode.staging.json (${staged.length})`);
  console.log(`  missing: data/geocode.missing.json (${missing.length})`);
  console.log('data/incidents.json and the database were NOT touched.');
  if (staged.some((s) => s.needsPdfGps)) {
    console.log(
      'NOTE: rows flagged needsPdfGps=true (e.g. JUL21-JHANJI-BUND) prefer the PDF GPS numbers — fill pdfGps manually on approval.'
    );
  }
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
