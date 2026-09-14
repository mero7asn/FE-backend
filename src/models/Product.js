const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  productNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  originalPrice: {
    type: Number,
    min: 0
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  images: [{
    url: String,
    alt: String,
    isPrimary: Boolean,
    isSecondary: Boolean
  }],
  sizes: [{
    size: {
      type: String,
      enum: ['M', 'L', 'XL', 'XXL'],
      required: true
    },
    stock: {
      type: Number,
      default: 0
    },
    isAvailable: {
      type: Boolean,
      default: true
    }
  }],
  colors: [String],
  isAvailable: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    default: 'T-Shirt'
  },
  whatsappNumber: {
    type: String,
    default: process.env.ADMIN_WHATSAPP || '+1234567890'
  },
  isAudiencePick: {
    type: Boolean,
    default: false
  },
  audienceMenPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  audienceWomenPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  votingDescription: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

productSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  if (this.originalPrice && this.originalPrice > 0) {
    if (this.price && this.price < this.originalPrice) {
      this.discountPercentage = Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
    } else {
      this.discountPercentage = 0;
      if (!this.price) {
        this.price = this.originalPrice;
      }
    }
  } else {
    this.discountPercentage = 0;
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
