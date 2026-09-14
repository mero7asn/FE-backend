const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: String,
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  minPurchase: {
    type: Number,
    default: 0
  },
  maxDiscount: Number,
  usageLimit: Number,
  usedCount: {
    type: Number,
    default: 0
  },
  startDate: Date,
  endDate: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  applicableProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  applicableDrops: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Drop'
  }]
}, {
  timestamps: true
});

couponSchema.methods.isValid = function(orderTotal) {
  const now = new Date();
  if (!this.isActive) return { valid: false, message: 'Coupon is inactive' };
  if (this.startDate && now < this.startDate) return { valid: false, message: 'Coupon not yet active' };
  if (this.endDate && now > this.endDate) return { valid: false, message: 'Coupon expired' };
  if (this.usageLimit && this.usedCount >= this.usageLimit) return { valid: false, message: 'Coupon usage limit reached' };
  if (orderTotal < this.minPurchase) return { valid: false, message: `Minimum purchase of ${this.minPurchase} required` };
  return { valid: true };
};

couponSchema.methods.calculateDiscount = function(orderTotal) {
  if (this.discountType === 'percentage') {
    const discount = (orderTotal * this.discountValue) / 100;
    return this.maxDiscount ? Math.min(discount, this.maxDiscount) : discount;
  }
  return Math.min(this.discountValue, orderTotal);
};

module.exports = mongoose.model('Coupon', couponSchema);
