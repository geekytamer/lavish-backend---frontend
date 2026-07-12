// Lightweight in-process protection for the public ad-tracking endpoints:
//  - per-IP rate limiting (blunt anti-flood)
//  - per (event, promo, client) deduplication within a time window
//
// This is single-process/in-memory, which suits this app's scale. A multi-node
// deployment should back these with a shared store (e.g. Redis) instead.

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 120; // events per IP per minute

const ipHits = new Map(); // ip -> { count, resetAt }
const seen = new Map(); // dedup key -> expiresAt

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

function rateLimit(req) {
  const ip = clientIp(req);
  const now = Date.now();
  let rec = ipHits.get(ip);
  if (!rec || now > rec.resetAt) {
    rec = { count: 0, resetAt: now + RATE_WINDOW_MS };
    ipHits.set(ip, rec);
  }
  rec.count += 1;
  return rec.count <= RATE_MAX;
}

// Returns true if this is the first time we've seen `key` inside `ttlMs`.
function firstSeen(key, ttlMs) {
  const now = Date.now();
  const exp = seen.get(key);
  if (exp && exp > now) return false;
  seen.set(key, now + ttlMs);
  return true;
}

function clientId(req) {
  return req.get('X-Client-Id') || clientIp(req);
}

// Periodic cleanup so the maps don't grow unbounded.
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of seen) if (v <= now) seen.delete(k);
  for (const [k, v] of ipHits) if (now > v.resetAt) ipHits.delete(k);
}, 5 * 60 * 1000);
if (cleanup.unref) cleanup.unref();

module.exports = { rateLimit, firstSeen, clientId, clientIp };
