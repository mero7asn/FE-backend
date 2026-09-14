module.exports = function geoBlock(req, res, next) {
  // Always allow preflight and health checks
  if (req.method === 'OPTIONS' || req.path === '/health') return next();

  const countryHeader = req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || '';
  const country = String(countryHeader).toUpperCase();

  // Vercel may supply placeholders or empty values before header resolution.
  if (!country || country.startsWith('$') || country === 'UNKNOWN') return next();

  // In local dev there's no geo header — allow through
  if (!country) return next();

  const ALLOWED_COUNTRIES = ['EG', 'SA'];
  if (!ALLOWED_COUNTRIES.includes(country)) {
    return res.status(403).json({ message: 'Service not available in your region.' });
  }

  next();
};
