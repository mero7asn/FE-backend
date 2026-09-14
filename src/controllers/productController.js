const crypto = require('crypto');
const Product = require('../models/Product');
const SoldProduct = require('../models/SoldProduct');
const Setting = require('../models/Setting');
const { safeRegex, pick } = require('../middleware/validate');
const { recordAuditLog } = require('../utils/audit');

const ALLOWED_FIELDS = ['name', 'description', 'price', 'originalPrice', 'discountPercentage', 'images', 'sizes', 'colors', 'isAvailable', 'isFeatured', 'whatsappNumber', 'category', 'isAudiencePick', 'audienceMenPercentage', 'audienceWomenPercentage', 'votingDescription'];

// Charset: uppercase letters + digits + special chars
const UOO_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@*$';

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

exports.getAllProducts = async (req, res) => {
  try {
    const { category, search, sort, size, color } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (search) filter.name = { $regex: safeRegex(search), $options: 'i' };
    if (color) filter.colors = { $regex: new RegExp(`^${safeRegex(color)}$`, 'i') };
    if (size) {
      filter.sizes = {
        $elemMatch: {
          size: size.toUpperCase(),
          isAvailable: true,
          stock: { $gt: 0 }
        }
      };
    }

    let query = Product.find(filter);

    if (sort === 'newest') query = query.sort({ createdAt: -1 });
    else if (sort === 'price-low') query = query.sort({ price: 1 });
    else if (sort === 'price-high') query = query.sort({ price: -1 });
    else if (sort === 'featured') query = query.sort({ isFeatured: -1 });

    const products = await query;
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ 
      $or: [{ _id: req.params.id }, { slug: req.params.id }] 
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create(pick(req.body, ALLOWED_FIELDS));

    // Auto-assign a unique Product Number (FE-XXXX)
    await assignProductNumber(product);

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'create_product',
      message: `Created product ${product.name} (${product.productNumber})`,
      details: { productId: product._id, productName: product.name, productNumber: product.productNumber }
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const updates = pick(req.body, ALLOWED_FIELDS);

    // Auto-manage size & product availability when sizes/stock are updated
    if (updates.sizes && Array.isArray(updates.sizes)) {
      let totalStock = 0;
      updates.sizes.forEach(s => {
        if (typeof s === 'object') {
          if (s.stock > 0) {
            s.isAvailable = true;
            totalStock += s.stock;
          } else {
            s.isAvailable = false;
          }
        }
      });
      if (totalStock > 0 && updates.isAvailable !== false) {
        updates.isAvailable = true;
      }
    }

    Object.assign(product, updates);
    await product.save();

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'update_product',
      message: `Updated product ${product.name}`,
      details: { productId: product._id, productName: product.name }
    });

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'delete_product',
      message: `Deleted product ${product.name}`,
      details: { productId: product._id, productName: product.name }
    });

    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({ isFeatured: true }).limit(8);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.toggleAvailability = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.isAvailable = !product.isAvailable;
    await product.save();

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'toggle_product_availability',
      message: `Set product ${product.name} as ${product.isAvailable ? 'available' : 'unavailable'}`,
      details: { productId: product._id, productName: product.name, isAvailable: product.isAvailable }
    });

    res.json({ message: `Product is now ${product.isAvailable ? 'available' : 'unavailable'}`, product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

function formatEgyptPhone(phoneStr) {
  if (!phoneStr) return '';
  let cleaned = String(phoneStr).trim().replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('0')) {
      cleaned = '+20' + cleaned.slice(1);
    } else {
      cleaned = '+20' + cleaned;
    }
  }
  return cleaned;
}

exports.updateSoldProductCustomer = async (req, res) => {
  try {
    const { customerName, customerPhone } = req.body;
    const sold = await SoldProduct.findById(req.params.id);
    if (!sold) return res.status(404).json({ message: 'Sold product record not found' });

    const formattedPhone = formatEgyptPhone(customerPhone);
    if (customerName) sold.customerName = customerName.trim();
    if (formattedPhone) sold.customerPhone = formattedPhone;
    await sold.save();

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'update_sold_product_customer',
      message: `Attached customer ${customerName || ''} to Amazon sale UOO: ${sold.uooNumber}`,
      details: { soldProductId: sold._id, uooNumber: sold.uooNumber, customerName, customerPhone: formattedPhone }
    });

    res.json(sold);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sellProductItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { size, color, customerName, customerPhone, saleChannel } = req.body;

    if (!size) {
      return res.status(400).json({ message: 'Size is required' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Ensure product has a productNumber (backfill for older products)
    if (!product.productNumber) {
      await assignProductNumber(product);
    }

    const sizeObj = product.sizes.find(s => s.size === size.toUpperCase());
    if (!sizeObj) {
      return res.status(404).json({ message: `Size ${size} not found on this product` });
    }

    if (sizeObj.stock <= 0) {
      return res.status(400).json({ message: `Size ${size} is out of stock` });
    }

    // Decrement stock
    sizeObj.stock -= 1;

    // Set size availability to false if stock reaches 0
    if (sizeObj.stock === 0) {
      sizeObj.isAvailable = false;
    }

    await product.save();

    const formattedPhone = formatEgyptPhone(customerPhone);

    // Generate a unique UOO number and create a SoldProduct record
    const uooNumber = await generateUOONumber();
    const soldProduct = await SoldProduct.create({
      product: product._id,
      productName: product.name,
      productNumber: product.productNumber,
      uooNumber,
      size: size.toUpperCase(),
      color: color || (product.colors && product.colors.length > 0 ? product.colors[0] : undefined),
      customerName: customerName ? customerName.trim() : undefined,
      customerPhone: formattedPhone || undefined,
      soldBy: req.user._id,
      saleChannel: saleChannel === 'amazon' ? 'amazon' : 'website'
    });

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'sell_product_item',
      message: `Sold 1 unit of ${product.name} (Size: ${size}) via ${saleChannel === 'amazon' ? 'Amazon' : 'Website'} — UOO: ${uooNumber}${customerName ? ` for ${customerName}` : ''}${formattedPhone ? ` (${formattedPhone})` : ''}. Stock left: ${sizeObj.stock}`,
      details: { productId: product._id, productName: product.name, size, stock: sizeObj.stock, uooNumber, customerName, customerPhone: formattedPhone, saleChannel: saleChannel === 'amazon' ? 'amazon' : 'website' }
    });

    res.json({ product, soldProduct });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllSoldProducts = async (req, res) => {
  try {
    const filter = {};
    if (req.query.includeDeleted !== 'true' || (req.user?.role !== 'superadmin' && req.user?.role !== 'admin')) {
      filter.isDeleted = { $ne: true };
    }

    if (req.query.dateFrom || req.query.dateTo) {
      filter.soldAt = {};
      if (req.query.dateFrom) {
        const from = new Date(req.query.dateFrom);
        if (!req.query.dateFrom.includes('T')) {
          from.setUTCHours(0, 0, 0, 0);
        }
        filter.soldAt.$gte = from;
      }
      if (req.query.dateTo) {
        const to = new Date(req.query.dateTo);
        if (!req.query.dateTo.includes('T')) {
          to.setUTCHours(23, 59, 59, 999);
        }
        filter.soldAt.$lte = to;
      }
    }

    const sold = await SoldProduct.find(filter)
      .sort({ soldAt: -1 })
      .populate('soldBy', 'name email')
      .populate('deletedBy', 'name email')
      .populate('product', 'images');
    res.json(sold);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSoldProduct = async (req, res) => {
  try {
    const sold = await SoldProduct.findById(req.params.id)
      .populate('soldBy', 'name email')
      .populate('deletedBy', 'name email')
      .populate('product', 'images name');
    if (!sold) return res.status(404).json({ message: 'Sold product record not found' });
    res.json(sold);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteSoldProduct = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only Admin can delete sold product records' });
    }

    const sold = await SoldProduct.findById(req.params.id);
    if (!sold) return res.status(404).json({ message: 'Sold product record not found' });
    if (sold.isDeleted) return res.status(400).json({ message: 'Sold product is already deleted' });

    sold.isDeleted = true;
    sold.deletedAt = new Date();
    sold.deletedBy = req.user._id;
    await sold.save();

    // Restore 1 unit to product stock
    const product = await Product.findById(sold.product);
    if (product) {
      const sizeObj = product.sizes.find(s => s.size.toUpperCase() === sold.size.toUpperCase());
      if (sizeObj) {
        sizeObj.stock += 1;
        sizeObj.isAvailable = true;
        await product.save();
      }
    }

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'delete_sold_product',
      message: `Deleted sold product record (UOO: ${sold.uooNumber}) and restored stock`,
      details: { soldProductId: sold._id, uooNumber: sold.uooNumber, size: sold.size }
    });

    res.json({ message: 'Sold product record deleted and stock restored', soldProduct: sold });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.restoreSoldProduct = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only Admin can restore sold product records' });
    }

    const sold = await SoldProduct.findById(req.params.id);
    if (!sold) return res.status(404).json({ message: 'Sold product record not found' });
    if (!sold.isDeleted) return res.status(400).json({ message: 'Sold product is not deleted' });

    // Deduct 1 unit from product stock if available
    const product = await Product.findById(sold.product);
    if (product) {
      const sizeObj = product.sizes.find(s => s.size.toUpperCase() === sold.size.toUpperCase());
      if (sizeObj && sizeObj.stock > 0) {
        sizeObj.stock -= 1;
        if (sizeObj.stock === 0) sizeObj.isAvailable = false;
        await product.save();
      }
    }

    sold.isDeleted = false;
    sold.deletedAt = null;
    sold.deletedBy = null;
    await sold.save();

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'restore_sold_product',
      message: `Restored sold product record (UOO: ${sold.uooNumber})`,
      details: { soldProductId: sold._id, uooNumber: sold.uooNumber, size: sold.size }
    });

    res.json({ message: 'Sold product record restored', soldProduct: sold });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.verifySoldProduct = async (req, res) => {
  try {
    // Read from req.body (POST) — '#' chars are JSON-safe but NOT URL-safe in query strings
    const { productNumber, uooNumber } = req.body;
    if (!productNumber || !uooNumber) {
      return res.status(400).json({ message: 'Product Number and UOO Number are required' });
    }

    const pn = productNumber.trim().toUpperCase();
    const uoo = uooNumber.trim().toUpperCase();

    // Try exact match first, then fallback matching # stripped (for old records where # was lost in transit)
    let sold = await SoldProduct.findOne({ productNumber: pn, uooNumber: uoo })
      .populate('product', 'images description colors name price');

    if (!sold) {
      // Find all records for this product and compare with # stripped on both sides
      const candidates = await SoldProduct.find({ productNumber: pn, isDeleted: { $ne: true } })
        .populate('product', 'images description colors name price');
      const uooStripped = uoo.replace(/#/g, '');
      sold = candidates.find(c => c.uooNumber.replace(/#/g, '') === uooStripped) || null;
    }

    if (!sold || sold.isDeleted) {
      return res.status(404).json({ verified: false, message: 'Invalid product or verification number' });
    }

    res.json({ verified: true, soldProduct: sold });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRecommendations = async (req, res) => {
  try {
    const { productId, size } = req.query;
    if (!size) {
      return res.json([]);
    }

    const sizeUpper = size.toUpperCase();
    const products = await Product.find({
      _id: { $ne: productId },
      isAvailable: true,
      sizes: {
        $elemMatch: {
          size: sizeUpper,
          isAvailable: true,
          stock: { $gt: 0 }
        }
      }
    }).limit(8);

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
