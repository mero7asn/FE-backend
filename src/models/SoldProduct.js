const mongoose = require('mongoose');

const soldProductSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  productNumber: {
    type: String,
    required: true
  },
  uooNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  size: {
    type: String,
    required: true
  },
  color: {
    type: String
  },
  customerName: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  soldBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // The customer who purchased via online checkout (distinct from soldBy which is the admin recorder)
  buyerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    index: true
  },
  saleChannel: {
    type: String,
    enum: ['website', 'amazon'],
    default: 'website'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  soldAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SoldProduct', soldProductSchema);
