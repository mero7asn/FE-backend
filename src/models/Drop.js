const mongoose = require('mongoose');

const dropSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Drop title is required'],
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: String,
  launchDate: {
    type: Date,
    required: [true, 'Launch date is required']
  },
  endDate: Date,
  status: {
    type: String,
    enum: ['upcoming', 'live', 'sold-out', 'archived'],
    default: 'upcoming'
  },
  featuredImage: String,
  bannerImage: String,
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  notifySubscribers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isPublished: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

dropSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

dropSchema.methods.updateStatus = function() {
  const now = new Date();
  if (now < this.launchDate) {
    this.status = 'upcoming';
  } else if (this.endDate && now > this.endDate) {
    this.status = 'archived';
  } else {
    this.status = 'live';
  }
};

module.exports = mongoose.model('Drop', dropSchema);
