const xss = require('xss');

const clean = (value) => {
  if (typeof value !== 'string') return value;
  return xss(value);
};

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    // uooNumber and productNumber are alphanumeric/special identifiers — never rendered as HTML.
    if (key === 'password' || key === 'uooNumber' || key === 'uoo' || key === 'productNumber') continue;
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
