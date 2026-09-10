// Tests for the ML-driven simulation loop (FR-10 bands, FR-11 incidents).
// Run: npx tsx --test src/services/simulation.test.ts
// Prerequisites: disaster-ML sidecar up (uvicorn serve:app --port 8000
// from backend/disaster-ml/src) and backend/prisma/dev.db present.
// The live assessment test fails loudly with that hint instead of
// silently passing without the engine.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessTruckMl,
  getMlState,
  getScenarioDate,
  getScenarioOverrides,
  mlMotionFor,
  setScenario,
} from './simulation.service.js';

describe('mlMotionFor (simulation motion rules)', () => {
  it('blocks on CRITICAL', () => {
    assert.equal(mlMotionFor('CRITICAL'), 'block');
  });

  it('slows on HIGH', () => {
    assert.equal(mlMotionFor('HIGH'), 'slow');
  });

  it('goes on LOW, MODERATE, null and unknown', () => {
    assert.equal(mlMotionFor('LOW'), 'go');
    assert.equal(mlMotionFor('MODERATE'), 'go');
    assert.equal(mlMotionFor(null), 'go');
    assert.equal(mlMotionFor('MYSTERY'), 'go');
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
  it('assesses Sivasagar peak as CRITICAL/block and depot as go', async () => {
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
    assert.equal(mlMotionFor(sivasagar.band), 'block');

    const depot = await assessTruckMl('AS-01-FOOD-04', 26.1844, 91.7458);
    assert.equal(depot.district, 'Kamrup Metropolitan');
    assert.equal(mlMotionFor(depot.band), 'go');

    const state = getMlState();
    assert.equal(state['AS-02-MED-11']?.band, 'CRITICAL');
    assert.equal(state['AS-01-FOOD-04']?.district, 'Kamrup Metropolitan');
  });
});
