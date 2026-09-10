// Unit tests for risk.level.ts (PROJECT.md FR-10 thresholds, FR-03 alerts).
// Run: npx tsx --test src/services/risk.level.test.ts
// Uses only node:test + node:assert — no new devDependencies.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, levelFor } from './risk.level.js';

describe('clamp', () => {
  it('passes through the unit interval', () => {
    assert.equal(clamp(0), 0);
    assert.equal(clamp(0.42), 0.42);
    assert.equal(clamp(1), 1);
  });

  it('clamps out-of-range probabilities', () => {
    assert.equal(clamp(-0.5), 0);
    assert.equal(clamp(1.5), 1);
  });
});

describe('levelFor (FR-10 score bands)', () => {
  it('maps LOW below 30', () => {
    assert.equal(levelFor(0), 'LOW');
    assert.equal(levelFor(29.9), 'LOW');
  });

  it('maps MEDIUM from 30', () => {
    assert.equal(levelFor(30), 'MEDIUM');
    assert.equal(levelFor(54.9), 'MEDIUM');
  });

  it('maps HIGH from 55', () => {
    assert.equal(levelFor(55), 'HIGH');
    assert.equal(levelFor(74.9), 'HIGH');
  });

  it('maps RED from 75', () => {
    assert.equal(levelFor(75), 'RED');
    assert.equal(levelFor(100), 'RED');
  });

  it('keeps alert-critical boundary monotonic (RED implies max score band)', () => {
    const scores = [0, 10, 30, 55, 75, 100];
    const order = { LOW: 0, MEDIUM: 1, HIGH: 2, RED: 3 } as const;
    const levels = scores.map(levelFor);
    for (let i = 1; i < levels.length; i += 1) {
      assert.ok(order[levels[i]!] >= order[levels[i - 1]!]);
    }
  });
});
