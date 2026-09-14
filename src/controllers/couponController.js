const Coupon = require('../models/Coupon');
const { pick } = require('../middleware/validate');
const { recordAuditLog } = require('../utils/audit');

const ALLOWED_COUPON_FIELDS = ['code', 'discountType', 'discountValue', 'minPurchase', 'usageLimit', 'maxDiscount', 'startDate', 'endDate', 'isActive', 'applicableProducts', 'applicableDrops'];

exports.validateCoupon = async (req, res) => {
  try {
    const { code, orderTotal } = req.body;
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return res.status(404).json({ message: 'Invalid coupon code' });
    }

    const validation = coupon.isValid(orderTotal);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const discount = coupon.calculateDiscount(orderTotal);

    res.json({
      code: coupon.code,
      discount,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.create(pick(req.body, ALLOWED_COUPON_FIELDS));

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'create_coupon',
      message: `Created coupon ${coupon.code}`,
      details: { couponId: coupon._id, couponCode: coupon.code }
    });

    res.status(201).json(coupon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, pick(req.body, ALLOWED_COUPON_FIELDS), { new: true });
    
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'update_coupon',
      message: `Updated coupon ${coupon.code}`,
      details: { couponId: coupon._id, couponCode: coupon.code }
    });

    res.json(coupon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'delete_coupon',
      message: `Deleted coupon ${coupon.code}`,
      details: { couponId: coupon._id, couponCode: coupon.code }
    });

    res.json({ message: 'Coupon deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
