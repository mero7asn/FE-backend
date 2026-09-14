const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  subtitle: String,
  description: String,
  image: String,
  mobileImage: String,
  ctaText: String,
  ctaLink: String,
  position: {
    type: String,
    enum: ['hero', 'secondary', 'announcement'],
    default: 'hero'
  },
  backgroundColor: String,
  textColor: String,
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startDate: Date,
  endDate: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('Banner', bannerSchema);
