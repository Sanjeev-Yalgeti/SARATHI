// Tests for the ML-driven simulation loop (FR-10 bands, FR-11 incidents).
// Run: npx tsx --test src/services/simulation.test.ts
// Prerequisites: disaster-ML sidecar up (uvicorn serve:app --port 8000
// from backend/disaster-ml/src) and backend/prisma/dev.db present.
// The live assessment test fails loudly with that hint instead of
// silently passing without the engine.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  alternateClearsTrigger,
  assessTruckMl,
  getRemainingPath,
  getMlState,
  getScenarioDate,
  getScenarioOverrides,
  mlMotionFor,
  replayFromDepot,
  routeDestination,
  setScenario,
  truckCorridor,
} from './simulation.service.js';
import { getRouteVia } from './routing.service.js';

describe('mlMotionFor (simulation motion rules)', () => {
  // ML never fully stops trucks — only real RED incidents block.
  // CRITICAL crawls, HIGH slows, everything else goes.
  it('slows on CRITICAL and HIGH', () => {
    assert.equal(mlMotionFor('CRITICAL'), 'slow');
    assert.equal(mlMotionFor('HIGH'), 'slow');
  });

  it('goes on LOW, MODERATE, null and unknown', () => {
    assert.equal(mlMotionFor('LOW'), 'go');
    assert.equal(mlMotionFor('MODERATE'), 'go');
    assert.equal(mlMotionFor(null), 'go');
    assert.equal(mlMotionFor('MYSTERY'), 'go');
  });
});

describe('alternateClearsTrigger (diversion bypass rule)', () => {
  const trigger = { lat: 26.5862, lng: 93.3081 }; // ASDMA-01
  const start = { lat: 26.55, lng: 93.2 };

  it('rejects a detour that clips the edge of the trigger zone', () => {
    const candidate = [
      { lat: 26.55, lng: 93.2 }, // escape segment (within 5 km of start)
      { lat: 26.62, lng: 93.28 }, // ~9 km from trigger — still inside, must fail
    ];
    assert.equal(alternateClearsTrigger(candidate, trigger, start), false);
  });

  it('rejects a candidate that runs through the trigger zone', () => {
    const candidate = [
      { lat: 26.55, lng: 93.2 },
      { lat: 26.5862, lng: 93.3081 }, // dead-centre of the RED zone
      { lat: 26.6, lng: 93.5 },
    ];
    assert.equal(alternateClearsTrigger(candidate, trigger, start), false);
  });

  it('accepts a genuine bypass far from the trigger', () => {
    const candidate = [
      { lat: 26.55, lng: 93.2 },
      { lat: 26.75, lng: 93.1 }, // ~25 km from trigger
      { lat: 26.8, lng: 93.5 },
    ];
    assert.equal(alternateClearsTrigger(candidate, trigger, start), true);
  });
});

describe('getRemainingPath (live map line)', () => {
  it('returns null for unknown vehicles', () => {
    assert.equal(getRemainingPath('NOPE-00'), null);
  });
});

describe('replayFromDepot (judge reset button)', () => {
  it('returns the fleet without throwing, scoped or not', () => {
    const all = replayFromDepot();
    assert.ok(Array.isArray(all) && all.length > 0);
    const one = replayFromDepot('NOPE-00');
    assert.ok(Array.isArray(one) && one.length === all.length);
  });
});

describe('routeDestination (diversion target)', () => {
  it('returns the final corridor waypoint per truck', () => {
    assert.deepEqual(routeDestination('AS-01-FOOD-04'), { lng: 93.97, lat: 26.51 });
    assert.deepEqual(routeDestination('AS-02-MED-11'), { lng: 94.6426, lat: 26.9826 });
    assert.deepEqual(routeDestination('AS-03-FUEL-07'), { lng: 94.6426, lat: 26.9826 });
    assert.deepEqual(routeDestination('AS-04-WATER-09'), { lng: 94.63, lat: 27.14 });
    assert.deepEqual(routeDestination('AS-05-SHELTER-12'), { lng: 93.97, lat: 26.51 });
  });

  it('returns null for unknown vehicles', () => {
    assert.equal(routeDestination('NOPE-00'), null);
  });
});

describe('truckCorridor (story path per truck)', () => {
  it('returns depot → via → destination waypoints per truck', () => {
    const water = truckCorridor('AS-04-WATER-09');
    assert.ok(water && water.length === 3);
    assert.deepEqual(water[0], { lng: 91.7458, lat: 26.1844 });
    assert.deepEqual(water[1], { lng: 94.2045, lat: 26.7531 }); // Jorhat
    assert.deepEqual(water[2], { lng: 94.63, lat: 27.14 });
  });

  it('returns null for unknown vehicles', () => {
    assert.equal(truckCorridor('NOPE-00'), null);
  });
});

describe('getRouteVia (chained story corridors)', () => {
  // Routers snap endpoints to the nearest road, so assert proximity (~1 km),
  // not exact equality.
  const near = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
    Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lng - b.lng) < 0.01;

  it('joins legs end-to-end from depot to destination', async () => {
    const from = { lat: 26.1844, lng: 91.7458 };
    const via = [{ lat: 26.75, lng: 94.21 }];
    const to = { lat: 27.14, lng: 94.63 };
    const route = await getRouteVia(from, via, to);
    assert.ok(route.primary.length >= 3);
    assert.ok(near(route.primary[0]!, from));
    assert.ok(near(route.primary[route.primary.length - 1]!, to));
    assert.ok(route.distance_km > 0 && route.duration_min > 0);
  });

  it('degenerates to a plain route without waypoints', async () => {
    const from = { lat: 26.1844, lng: 91.7458 };
    const to = { lat: 26.51, lng: 93.97 };
    const route = await getRouteVia(from, [], to);
    assert.ok(near(route.primary[0]!, from));
    assert.ok(near(route.primary[route.primary.length - 1]!, to));
  });
});

describe('setScenario (what-if controls)', () => {
  it('sets date and knobs together', () => {
    setScenario('2026-07-28', { rainfall_mm: 150 });
    assert.equal(getScenarioDate(), '2026-07-28');
    assert.deepEqual(getScenarioOverrides(), { rainfall_mm: 150 });
    setScenario('2026-07-28'); // reset knobs
    assert.deepEqual(getScenarioOverrides(), {});
  });
});

describe('assessTruckMl (live engine wire)', () => {
  it('assesses Sivasagar peak as CRITICAL/slow and depot as go', async () => {
    setScenario('2026-07-28');
    let sivasagar;
    try {
      sivasagar = await assessTruckMl('AS-02-MED-11', 27.14, 94.63);
    } catch {
      assert.fail('sidecar unreachable — start it first: uvicorn serve:app --port 8000');
    }
    assert.equal(sivasagar.district, 'Sivasagar');
    assert.equal(sivasagar.source, 'ml');
    assert.equal(sivasagar.band, 'CRITICAL');
    assert.equal(mlMotionFor(sivasagar.band), 'slow');

    const depot = await assessTruckMl('AS-01-FOOD-04', 26.1844, 91.7458);
    assert.equal(depot.district, 'Kamrup Metropolitan');
    assert.equal(mlMotionFor(depot.band), 'go');

    const state = getMlState();
    assert.equal(state['AS-02-MED-11']?.band, 'CRITICAL');
    assert.equal(state['AS-01-FOOD-04']?.district, 'Kamrup Metropolitan');
  });
});
