const test = require('node:test');
const assert = require('node:assert');
const { estimateSpend, isOverBudget, derivePromoStatus, isServable } = require('../src/lib/ads');

const HOUR = 3600 * 1000;
const now = Date.UTC(2026, 6, 8, 12, 0, 0); // fixed reference instant

test('estimateSpend: CPM = impressions/1000 * rate', () => {
  assert.strictEqual(estimateSpend({ pricing_model: 'cpm', rate: 12.5, impressions: 4000 }), 50);
  assert.strictEqual(estimateSpend({ pricing_model: 'cpm', rate: 10, impressions: 0 }), 0);
});

test('estimateSpend: CPC = clicks * rate', () => {
  assert.strictEqual(estimateSpend({ pricing_model: 'cpc', rate: 0.5, clicks: 30 }), 15);
});

test('estimateSpend: flat = rate regardless of traffic', () => {
  assert.strictEqual(estimateSpend({ pricing_model: 'flat', rate: 200, impressions: 999999 }), 200);
});

test('isOverBudget: only when a cap is set and reached', () => {
  assert.strictEqual(isOverBudget({ budget: 0, pricing_model: 'cpm', rate: 10, impressions: 1e9 }), false);
  assert.strictEqual(isOverBudget({ budget: 100, pricing_model: 'cpc', rate: 1, clicks: 99 }), false);
  assert.strictEqual(isOverBudget({ budget: 100, pricing_model: 'cpc', rate: 1, clicks: 100 }), true);
});

test('derivePromoStatus: paused when switched off', () => {
  assert.strictEqual(derivePromoStatus({ active: 0 }, now), 'paused');
});

test('derivePromoStatus: scheduled before start, active during, expired after', () => {
  const base = { active: 1, start_at: new Date(now - HOUR).toISOString(), end_at: new Date(now + HOUR).toISOString() };
  assert.strictEqual(derivePromoStatus(base, now), 'active');
  assert.strictEqual(derivePromoStatus({ ...base, start_at: new Date(now + HOUR).toISOString() }, now), 'scheduled');
  assert.strictEqual(derivePromoStatus({ ...base, end_at: new Date(now - HOUR).toISOString() }, now), 'expired');
});

test('derivePromoStatus: depleted when budget cap reached', () => {
  const row = { active: 1, budget: 50, pricing_model: 'cpm', rate: 12.5, impressions: 4000 };
  assert.strictEqual(derivePromoStatus(row, now), 'depleted');
});

test('derivePromoStatus is timezone-correct (ISO instants compare exactly)', () => {
  // A campaign that ends at 12:00Z is expired at 12:00:01Z regardless of server TZ.
  const row = { active: 1, end_at: '2026-07-08T12:00:00.000Z' };
  assert.strictEqual(derivePromoStatus(row, Date.UTC(2026, 6, 8, 11, 59, 59)), 'active');
  assert.strictEqual(derivePromoStatus(row, Date.UTC(2026, 6, 8, 12, 0, 1)), 'expired');
});

test('isServable only for active campaigns', () => {
  assert.strictEqual(isServable({ active: 1 }, now), true);
  assert.strictEqual(isServable({ active: 0 }, now), false);
  assert.strictEqual(isServable({ active: 1, budget: 10, pricing_model: 'flat', rate: 10 }, now), false); // depleted
});
