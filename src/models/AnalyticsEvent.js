const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['page_view', 'order_click'],
    required: true,
    index: true
  },
  governorate: {
    type: String,
    default: 'Unknown',
    index: true
  },
  city: {
    type: String,
    default: ''
  },
  ipHash: {
    type: String, // SHA-256 hash of IP — never store raw IPs
    default: ''
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },
  page: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Compound index for fast aggregation queries
analyticsEventSchema.index({ type: 1, governorate: 1 });
analyticsEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
