const xss = require('xss');

const clean = (value) => {
  if (typeof value !== 'string') return value;
  return xss(value);
};

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    // Passwords are credentials and must be compared exactly as entered.
    // uooNumber is a fixed-charset code (A-Z, 0-9, !@*$#) — never rendered as HTML.
    if (key === 'password' || key === 'uooNumber') continue;
    if (typeof obj[key] === 'string') obj[key] = clean(obj[key]);
    else if (typeof obj[key] === 'object') sanitizeObject(obj[key]);
  }
  return obj;
};

module.exports = (req, res, next) => {
  sanitizeObject(req.body);
  sanitizeObject(req.query);
  sanitizeObject(req.params);
  next();
};
