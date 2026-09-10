// Pure risk-level helpers — dependency-free by design so they can be
// unit-tested without pulling in prisma/axios (see risk.level.test.ts).
// PROJECT.md FR-10: weighted score -> band mapping used by alerts.

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'RED';

export function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function levelFor(score: number): RiskLevel {
  if (score >= 75) return 'RED';
  if (score >= 55) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}
