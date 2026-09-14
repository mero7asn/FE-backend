const crypto = require('crypto');

const INTEGRITY_SECRET = process.env.INTEGRITY_SECRET || process.env.JWT_SECRET;

// Signs the response body with HMAC-SHA256 and attaches it as a header
const signResponse = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    const payload = JSON.stringify(body);
    const signature = crypto
      .createHmac('sha256', INTEGRITY_SECRET)
      .update(payload)
      .digest('hex');

    res.setHeader('X-Response-Signature', signature);
    return originalJson(body);
  };

  next();
};

// Verifies the incoming POST/PUT/PATCH request body hasn't been tampered with.
// Frontend must send X-Request-Signature header with HMAC of the request body.
const verifyRequest = (req, res, next) => {
  const methods = ['POST', 'PUT', 'PATCH'];
  if (!methods.includes(req.method)) return next();

  // Webhooks from third-party payment gateways (Paymob, Stripe) have their own signature mechanisms
  if (req.originalUrl?.includes('/webhook') || req.path?.includes('/webhook')) return next();

  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('multipart/form-data')) return next();

  const signature = req.headers['x-request-signature'];
  if (!signature) {
    if (!req.body || Object.keys(req.body).length === 0) return next();
    return res.status(400).json({ message: 'Missing request signature' });
  }

  const payload = JSON.stringify(req.body || {});
  const expected = crypto
    .createHmac('sha256', INTEGRITY_SECRET)
    .update(payload)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    return res.status(400).json({ message: 'Request integrity check failed' });
  }

  next();
};

module.exports = { signResponse, verifyRequest };
