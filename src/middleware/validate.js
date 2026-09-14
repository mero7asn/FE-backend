const mongoose = require('mongoose');

// Validates MongoDB ObjectId in route params
const validateObjectId = (req, res, next) => {
  if (req.params.id && !mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid ID format' });
  }
  next();
};

// Escapes special regex characters to prevent ReDoS
const safeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Picks only whitelisted fields from an object
const pick = (obj, allowedFields) => {
  const result = {};
  for (const field of allowedFields) {
    if (obj[field] !== undefined) result[field] = obj[field];
  }
  return result;
};

module.exports = { validateObjectId, safeRegex, pick };
