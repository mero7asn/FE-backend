const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Setting = require('../models/Setting');
const SoldProduct = require('../models/SoldProduct');
const { generateUOONumber, assignProductNumber, formatEgyptPhone } = require('../utils/uoo');
const { recordAuditLog } = require('../utils/audit');
const crypto = require('crypto');

// Helper to calculate pricing on server
async function calculateOrderPricing(items, couponCode) {
  let subtotal = 0;
  const processedItems = [];

  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product) {
      throw new Error(`Product not found: ${item.product}`);
    }

    const normalizedSizes = (product.sizes || []).map(s =>
      typeof s === 'string' ? { size: s, stock: 1, isAvailable: true } : s
    );
    const sizeObj = normalizedSizes.find(s => s.size.toUpperCase() === (item.size || '').toUpperCase());

    if (!sizeObj || !sizeObj.isAvailable || sizeObj.stock < item.quantity) {
      throw new Error(`Item ${product.name} (Size: ${item.size}) is out of stock or requested quantity unavailable`);
    }

    const itemPrice = Number(product.price) || 0;
    subtotal += itemPrice * item.quantity;

    processedItems.push({
      product: product._id,
      name: product.name,
      size: (item.size || '').toUpperCase(),
      color: item.color || (product.colors?.[0] || 'Standard'),
      quantity: item.quantity,
      price: itemPrice
    });
  }

  // Load store payment & shipping settings
  const paymentSettingDoc = await Setting.findOne({ key: 'payment_settings' });
  const paymentSettings = paymentSettingDoc?.value || {};
  const shippingRate = Number(paymentSettings.shippingRate) || 75;
  const freeThreshold = Number(paymentSettings.freeShippingThreshold) || 2000;

  const shipping = subtotal >= freeThreshold ? 0 : shippingRate;

  // Coupon calculation
  let discount = 0;
  let validatedCoupon = null;

  if (couponCode) {
    const coupon = await Coupon.findOne({ code: String(couponCode).toUpperCase() });
    if (coupon) {
      const val = coupon.isValid(subtotal);
      if (val.valid) {
        discount = coupon.calculateDiscount(subtotal);
        validatedCoupon = {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          discount
        };
      }
    }
  }

  const total = Math.max(0, subtotal - discount + shipping);

  return {
    processedItems,
    pricing: {
      subtotal,
      shipping,
      discount,
      total
    },
    validatedCoupon,
    paymentSettings
  };
}

// Fulfill paid order: deduct stock & auto-generate digital UUO Authenticity Cards
async function fulfillPaidOrder(order) {
  if (order.status === 'paid' || order.payment?.status === 'paid') {
    // Atomically claim the fulfillment work. Payment gateways and browsers can
    // retry confirmations, so only one request may deduct stock or issue cards.
    const claimedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        $or: [
          { fulfillmentStatus: { $exists: false } },
          { fulfillmentStatus: 'pending' }
        ]
      },
      {
        $set: {
          fulfillmentStatus: 'processing',
          fulfillmentStartedAt: new Date(),
          fulfillmentError: null
        }
      },
      { new: true }
    );

    // It was already completed, failed, or is being handled by another
    // request. Failed fulfillment is deliberately not retried automatically:
    // it may have made partial stock/card changes and needs reconciliation.
    if (!claimedOrder) return false;

    try {
    // Deduct stock and generate sold cards for each item
    for (const item of claimedOrder.items) {
      const product = await Product.findById(item.product);
      if (!product) throw new Error(`Product not found during fulfillment: ${item.product}`);

      if (!product.productNumber) {
        await assignProductNumber(product);
      }

      // Deduct stock
      const sizeObj = (product.sizes || []).find(s => 
        (typeof s === 'string' ? s : s.size).toUpperCase() === (item.size || '').toUpperCase()
      );
      if (sizeObj && typeof sizeObj === 'object') {
        sizeObj.stock = Math.max(0, sizeObj.stock - item.quantity);
        if (sizeObj.stock === 0) sizeObj.isAvailable = false;
        await product.save();
      }

      // Generate UOO Authenticity Card for each unit sold
      for (let q = 0; q < item.quantity; q++) {
        try {
          const uooNumber = await generateUOONumber();
          await SoldProduct.create({
            product: product._id,
            productName: product.name,
            productNumber: product.productNumber || 'FE-0001',
            uooNumber,
            size: (item.size || '').toUpperCase(),
            color: item.color || 'Standard',
            customerName: claimedOrder.shippingAddress?.name || 'Customer',
            customerPhone: formatEgyptPhone(claimedOrder.shippingAddress?.phone),
            saleChannel: 'website',
            order: claimedOrder._id,
            buyerUserId: claimedOrder.user || null
          });
        } catch (err) {
          throw new Error(`Could not issue UUO card: ${err.message}`);
        }
      }
    }

    await Order.findByIdAndUpdate(claimedOrder._id, {
      $set: { fulfillmentStatus: 'completed', fulfilledAt: new Date(), fulfillmentError: null }
    });
    return true;
    } catch (error) {
      await Order.findByIdAndUpdate(claimedOrder._id, {
        $set: { fulfillmentStatus: 'failed', fulfillmentError: error.message.slice(0, 500) }
      });
      throw error;
    }
  }

  return false;
}

// 1. Initiate Checkout / Create Order & Payment Intent
exports.initiateCheckout = async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      billingAddress,
      paymentMethod, // 'card', 'wallet', 'cod'
      couponCode,
      notes
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    if (!shippingAddress?.phone || !shippingAddress?.address) {
      return res.status(400).json({ message: 'Phone number and address are required' });
    }

    const {
      processedItems,
      pricing,
      validatedCoupon,
      paymentSettings
    } = await calculateOrderPricing(items, couponCode);

    const activeGateway = paymentSettings.activeGateway || 'paymob';
    const method = paymentMethod || (activeGateway === 'cod' ? 'cod' : 'card');

    // Create Order Record in DB
    const order = await Order.create({
      user: req.user._id,
      items: processedItems,
      shippingAddress: {
        name: shippingAddress.name || req.user.name,
        street: shippingAddress.address,
        city: shippingAddress.city || 'Cairo',
        state: shippingAddress.state || 'Cairo',
        zipCode: shippingAddress.zipCode || '',
        country: 'Egypt',
        phone: formatEgyptPhone(shippingAddress.phone)
      },
      billingAddress: billingAddress || {
        name: shippingAddress.name || req.user.name,
        street: shippingAddress.address,
        city: shippingAddress.city || 'Cairo',
        phone: formatEgyptPhone(shippingAddress.phone)
      },
      payment: {
        method,
        status: method === 'cod' ? 'pending' : 'pending'
      },
      pricing,
      coupon: validatedCoupon,
      notes: notes || '',
      status: method === 'cod' ? 'processing' : 'pending'
    });

    if (validatedCoupon) {
      await Coupon.findOneAndUpdate(
        { code: validatedCoupon.code },
        { $inc: { usedCount: 1 } }
      );
    }

    // If Cash on Delivery, order is placed immediately
    if (method === 'cod') {
      return res.status(201).json({
        success: true,
        orderId: order._id,
        orderNumber: order.orderNumber,
        method: 'cod',
        message: 'Order placed with Cash on Delivery'
      });
    }

    // For Card / Online Payment:
    // Generate gateway integration response based on settings
    let gatewayData = {
      gateway: activeGateway,
      orderId: order._id,
      orderNumber: order.orderNumber,
      amountCents: Math.round(pricing.total * 100),
      currency: 'EGP'
    };

    if (activeGateway === 'paymob') {
      const paymobConfig = paymentSettings.paymob || {};
      const iframeId = paymobConfig.iframeId || '12345';
      const publicKey = paymobConfig.publicKey || 'mock_paymob_public_key';
      
      // Provide payment token / iframe link
      gatewayData.paymob = {
        iframeUrl: `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=MOCK_TOKEN_${order._id}`,
        clientSecret: `paymob_token_${order._id}`,
        publicKey,
        integrationId: method === 'wallet' ? paymobConfig.integrationIdWallet : paymobConfig.integrationIdCard
      };
    } else if (activeGateway === 'stripe') {
      const stripeConfig = paymentSettings.stripe || {};
      gatewayData.stripe = {
        publishableKey: stripeConfig.publishableKey || '',
        clientSecret: `pi_mock_${order._id}_secret_demo`
      };
    }

    res.status(201).json({
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      method,
      pricing,
      gatewayData
    });
  } catch (error) {
    console.error('initiateCheckout error:', error);
    res.status(400).json({ message: error.message || 'Failed to initiate checkout' });
  }
};

// 2. Verify or Confirm Payment
exports.verifyPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { transactionId, status } = req.body;

    const order = await Order.findById(orderId).populate('items.product user');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isPrivileged = ['admin', 'superadmin'].includes(req.user?.role);
    if (!isPrivileged && order.user?._id?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Mark as paid if success
    const isSuccess = status === 'success' || status === 'paid' || !status; // sandbox auto-confirms if simulated
    if (isSuccess) {
      if (order.payment.status !== 'paid') {
        order.payment.status = 'paid';
        order.payment.transactionId = transactionId || `TXN_${Date.now()}`;
        order.payment.paidAt = new Date();
        order.status = 'processing';
        await order.save();
      }

      // Safe on retries: fulfillment is atomically claimed above.
      const fulfilledNow = await fulfillPaidOrder(order);

      if (fulfilledNow) {
        await recordAuditLog({
          actor: req.user?._id || order.user?._id || null,
          targetUser: order.user?._id || null,
          action: 'order_payment_verified',
          message: `Order #${order.orderNumber} payment verified successfully`,
          details: { orderId: order._id, amount: order.pricing.total, transactionId: order.payment.transactionId }
        });
      }
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('verifyPayment error:', error);
    res.status(500).json({ message: error.message || 'Failed to verify payment' });
  }
};

// 3. Payment Gateway Webhook (External callback)
exports.handleWebhook = async (req, res) => {
  try {
    const payload = req.body;
    console.log('Payment webhook received:', JSON.stringify(payload));

    // Handle Paymob Transaction Callback structure
    if (payload?.obj?.order?.merchant_order_id || payload?.orderId) {
      const orderId = payload?.obj?.order?.merchant_order_id || payload?.orderId;
      const isSuccess = payload?.obj?.success === true || payload?.success === true;
      const txnId = payload?.obj?.id || payload?.id;

      const order = await Order.findById(orderId);
      if (order && isSuccess) {
        if (order.payment.status !== 'paid') {
          order.payment.status = 'paid';
          order.payment.transactionId = String(txnId);
          order.payment.paidAt = new Date();
          order.status = 'processing';
          await order.save();
        }

        await fulfillPaidOrder(order);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('handleWebhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
};
