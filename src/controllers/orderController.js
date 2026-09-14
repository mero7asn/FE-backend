const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const { safeRegex, pick } = require('../middleware/validate');
const { recordAuditLog } = require('../utils/audit');

const ALLOWED_ORDER_UPDATE = ['status', 'trackingNumber', 'adminNotes'];

exports.createOrder = async (req, res) => {
  return res.status(410).json({
    message: 'This checkout endpoint is retired. Use /api/payments/initiate instead.'
  });

  /*
  try {
    const { items, shippingAddress, billingAddress, payment, pricing, coupon } = req.body;

    let validatedCoupon = null;
    if (coupon && coupon.code) {
      const foundCoupon = await Coupon.findOne({ code: coupon.code.toUpperCase() });
      if (!foundCoupon) {
        return res.status(400).json({ message: 'Invalid coupon code' });
      }
      const orderTotal = pricing?.total || pricing?.subtotal || 0;
      const validation = foundCoupon.isValid(orderTotal);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }
      validatedCoupon = {
        code: foundCoupon.code,
        discountType: foundCoupon.discountType,
        discountValue: foundCoupon.discountValue,
        discount: foundCoupon.calculateDiscount(orderTotal)
      };
    }

    for (const item of items) {
      const product = await Product.findById(item.product);
      const variant = product.variants.find(v => v.size === item.size && v.color === item.color);
      
      if (!variant || variant.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      }

      variant.stock -= item.quantity;
      product.updateStatus();
      await product.save();
    }

    const order = await Order.create({
      user: req.user._id,
      items,
      shippingAddress,
      billingAddress,
      payment,
      pricing,
      coupon: validatedCoupon
    });

    if (validatedCoupon) {
      await Coupon.findOneAndUpdate(
        { code: validatedCoupon.code },
        { $inc: { usedCount: 1 } }
      );
    }

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
  */
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).populate('items.product').sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product user');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.user._id.toString() !== req.user._id.toString() && req.user.role === 'customer') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (search) filter.orderNumber = { $regex: safeRegex(search), $options: 'i' };

    const orders = await Order.find(filter).populate('user items.product').sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, trackingNumber, adminNotes } = pick(req.body, ALLOWED_ORDER_UPDATE);
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (status) order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (adminNotes) order.adminNotes = adminNotes;

    if (status === 'shipped' && !order.shippedAt) {
      order.shippedAt = Date.now();
    }
    if (status === 'delivered' && !order.deliveredAt) {
      order.deliveredAt = Date.now();
    }

    await order.save();

    await recordAuditLog({
      actor: req.user._id,
      targetUser: order.user,
      action: 'update_order_status',
      message: `Updated order ${order._id} status to ${order.status}`,
      details: { orderId: order._id, status: order.status, trackingNumber: order.trackingNumber }
    });

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getOrderStats = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $match: { 'payment.status': 'paid' } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]);

    const ordersByStatus = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      ordersByStatus
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
