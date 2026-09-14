const crypto = require('crypto');
const SoldProduct = require('../models/SoldProduct');
const Setting = require('../models/Setting');

const UOO_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';

async function generateUOONumber() {
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    let uoo = '';
    const bytes = crypto.randomBytes(8);
    for (let j = 0; j < 8; j++) {
      uoo += UOO_CHARSET[bytes[j] % UOO_CHARSET.length];
    }
    const exists = await SoldProduct.findOne({ uooNumber: uoo });
    if (!exists) return uoo;
  }
  throw new Error('Failed to generate unique UOO number');
}

async function assignProductNumber(product) {
  const counter = await Setting.findOneAndUpdate(
    { key: 'productNumberCounter' },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  const num = String(counter.value).padStart(4, '0');
  product.productNumber = `FE-${num}`;
  await product.save();
}

function formatEgyptPhone(phoneStr) {
  if (!phoneStr) return '';
  let cleaned = String(phoneStr).trim().replace(/[^\d+]/g, '');
  if (!cleaned) return '';

  // Already international format
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Saudi Arabia: 00966 or 966 or 05xxxxxxxx
  if (cleaned.startsWith('00966')) {
    return '+' + cleaned.slice(2);
  }
  if (cleaned.startsWith('966')) {
    return '+' + cleaned;
  }
  if (cleaned.startsWith('05') && cleaned.length === 10) {
    return '+966' + cleaned.slice(1);
  }

  // Egypt: 0020 or 20 or 01xxxxxxxxx
  if (cleaned.startsWith('0020')) {
    return '+' + cleaned.slice(2);
  }
  if (cleaned.startsWith('20')) {
    return '+' + cleaned;
  }
  if (cleaned.startsWith('0')) {
    return '+20' + cleaned.slice(1);
  }

  return '+20' + cleaned;
}

module.exports = {
  generateUOONumber,
  assignProductNumber,
  formatEgyptPhone
};
