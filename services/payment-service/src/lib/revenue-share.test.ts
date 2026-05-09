import { describe, expect, it } from 'vitest';
import { calculateRevenueSplit } from './revenue-share';

describe('calculateRevenueSplit', () => {
  it('uses 70/30 split by default ratio', () => {
    const result = calculateRevenueSplit(1_000_000, 0.7);
    expect(result.netAmount).toBe(700000);
    expect(result.platformFee).toBe(300000);
    expect(result.revenueSharePct).toBe(0.7);
    expect(result.platformFeePct).toBe(0.3);
  });

  it('supports custom ratio from config', () => {
    const result = calculateRevenueSplit(250_000, 0.65);
    expect(result.netAmount).toBe(162500);
    expect(result.platformFee).toBe(87500);
    expect(result.revenueSharePct).toBe(0.65);
    expect(result.platformFeePct).toBe(0.35);
  });
});
