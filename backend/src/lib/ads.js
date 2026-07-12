// Pure ad-campaign logic (no DB/HTTP) so it can be unit-tested in isolation.
//
// Scheduling is timezone-correct: start_at/end_at are stored as absolute ISO
// instants (UTC, e.g. "2026-07-08T10:30:00.000Z"). Date.parse of an ISO string
// with an offset/Z is unambiguous, so comparisons against Date.now() are exact
// regardless of the server's local timezone.

function estimateSpend(row) {
  const rate = Number(row.rate) || 0;
  switch (row.pricing_model) {
    case 'cpm':
      return ((Number(row.impressions) || 0) / 1000) * rate;
    case 'cpc':
      return (Number(row.clicks) || 0) * rate;
    case 'flat':
    default:
      return rate; // flat sponsorship fee for the whole flight
  }
}

function isOverBudget(row) {
  const budget = Number(row.budget) || 0;
  if (budget <= 0) return false; // no cap set
  return estimateSpend(row) >= budget;
}

// Lifecycle status, derived from the manual on/off flag, the flight window and
// the budget. Only `active` campaigns are served to the app.
//   paused    -> switched off
//   expired   -> past end_at
//   depleted  -> budget cap reached (auto-paused)
//   scheduled -> before start_at
//   active    -> live right now
function derivePromoStatus(row, now = Date.now()) {
  if (!row.active) return 'paused';
  const start = row.start_at ? Date.parse(row.start_at) : null;
  const end = row.end_at ? Date.parse(row.end_at) : null;
  if (end != null && !Number.isNaN(end) && now > end) return 'expired';
  if (isOverBudget(row)) return 'depleted';
  if (start != null && !Number.isNaN(start) && now < start) return 'scheduled';
  return 'active';
}

function isServable(row, now = Date.now()) {
  return derivePromoStatus(row, now) === 'active';
}

module.exports = { estimateSpend, isOverBudget, derivePromoStatus, isServable };
