const config = require('../config');

function baseUrlForRequest(req) {
  if (config.publicUrl) return config.publicUrl.replace(/\/$/, '');
  const protocol = req?.protocol || 'http';
  const host = req?.get ? req.get('host') : `localhost:${config.port || 4000}`;
  return `${protocol}://${host}`;
}

function resolveUrl(req, value) {
  if (!value) return '';
  const base = baseUrlForRequest(req);
  try {
    const url = new URL(value, base);
    if (['localhost', '127.0.0.1'].includes(url.hostname)) {
      const b = new URL(base);
      url.protocol = b.protocol;
      url.host = b.host;
    }
    return url.toString();
  } catch (e) {
    const safeBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const path = value.startsWith('/') ? value : `/${value}`;
    return `${safeBase}${path}`;
  }
}

function toRelative(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.pathname + url.search + url.hash;
  } catch (e) {
    return value.startsWith('/') ? value : `/${value}`;
  }
}

module.exports = { baseUrlForRequest, resolveUrl, toRelative };
