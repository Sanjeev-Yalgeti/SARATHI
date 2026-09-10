// Unit tests for ml-district.ts (simulation <-> ML bridge).
// Run: npx tsx --test src/services/ml-district.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICT_CENTROIDS, isMlBand, mlBandToScore, nearestDistrict } from './ml-district.js';

describe('nearestDistrict (corridor mapping)', () => {
  it('maps the Guwahati depot to Kamrup Metropolitan', () => {
    assert.equal(nearestDistrict(26.1844, 91.7458), 'Kamrup Metropolitan');
  });

  it('maps the Golaghat relief camp to Golaghat', () => {
    assert.equal(nearestDistrict(26.51, 93.97), 'Golaghat');
  });

  it('maps the Sivasagar terminus to Sivasagar', () => {
    assert.equal(nearestDistrict(27.14, 94.63), 'Sivasagar');
  });

  it('only ever returns corridor districts', () => {
    const names = new Set(DISTRICT_CENTROIDS.map((c) => c.district));
    for (const [lat, lng] of [[26.4, 93.0], [27.0, 94.0], [26.0, 92.0]] as const) {
      assert.ok(names.has(nearestDistrict(lat, lng)));
    }
  });
});

describe('mlBandToScore (FR-10 bands)', () => {
  it('maps CRITICAL to the RED band', () => {
    assert.deepEqual(mlBandToScore('CRITICAL'), { score: 85, level: 'RED' });
  });

  it('maps HIGH above MEDIUM above LOW', () => {
    assert.ok(mlBandToScore('HIGH').score > mlBandToScore('MODERATE').score);
    assert.ok(mlBandToScore('MODERATE').score > mlBandToScore('LOW').score);
  });

  it('falls back to LOW on unknown bands (never crashes the tick)', () => {
    assert.deepEqual(mlBandToScore('MYSTERY'), { score: 15, level: 'LOW' });
  });
});

describe('isMlBand', () => {
  it('accepts the four trained classes only', () => {
    for (const band of ['LOW', 'MODERATE', 'HIGH', 'CRITICAL']) assert.ok(isMlBand(band));
    assert.ok(!isMlBand('RED'));
    assert.ok(!isMlBand(''));
    assert.ok(!isMlBand(undefined));
  });
});
