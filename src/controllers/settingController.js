const Setting = require('../models/Setting');
const { recordAuditLog } = require('../utils/audit');

const DEFAULT_WORK_MODEL = 'whatsapp';
const DEFAULT_PAYMENT_SETTINGS = {
  activeGateway: 'paymob',
  enableCOD: true,
  currency: 'EGP',
  shippingRate: 75,
  freeShippingThreshold: 2000,
  paymob: {
    apiKey: '',
    secretKey: '',
    publicKey: '',
    integrationIdCard: '',
    integrationIdWallet: '',
    iframeId: '',
    hmacSecret: '',
    isLive: false
  },
  stripe: {
    publishableKey: '',
    secretKey: '',
    webhookSecret: '',
    isLive: false
  }
};

// Public endpoint for customer-facing store features (no secrets exposed)
exports.getPublicSettings = async (req, res) => {
  try {
    const workModelDoc = await Setting.findOne({ key: 'work_model' });
    const paymentDoc = await Setting.findOne({ key: 'payment_settings' });

    const workModel = workModelDoc?.value || DEFAULT_WORK_MODEL;
    const payment = paymentDoc?.value || DEFAULT_PAYMENT_SETTINGS;

    res.json({
      workModel,
      activeGateway: payment.activeGateway || 'paymob',
      enableCOD: payment.enableCOD ?? true,
      currency: payment.currency || 'EGP',
      shippingRate: payment.shippingRate ?? 75,
      freeShippingThreshold: payment.freeShippingThreshold ?? 2000,
      stripePublishableKey: payment.stripe?.publishableKey || '',
      paymobPublicKey: payment.paymob?.publicKey || '',
      paymobIframeId: payment.paymob?.iframeId || '',
      paymobIsLive: payment.paymob?.isLive || false,
      stripeIsLive: payment.stripe?.isLive || false
    });
  } catch (error) {
    console.error('getPublicSettings error:', error);
    res.status(500).json({ message: 'Failed to fetch public settings' });
  }
};

// Admin endpoint: view all configuration settings (including keys)
exports.getAdminSettings = async (req, res) => {
  try {
    const workModelDoc = await Setting.findOne({ key: 'work_model' });
    const paymentDoc = await Setting.findOne({ key: 'payment_settings' });

    res.json({
      workModel: workModelDoc?.value || DEFAULT_WORK_MODEL,
      paymentSettings: paymentDoc?.value ? { ...DEFAULT_PAYMENT_SETTINGS, ...paymentDoc.value } : DEFAULT_PAYMENT_SETTINGS
    });
  } catch (error) {
    console.error('getAdminSettings error:', error);
    res.status(500).json({ message: 'Failed to fetch admin settings' });
  }
};

// Admin endpoint: toggle/update work model ('whatsapp' | 'card_checkout')
exports.updateWorkModel = async (req, res) => {
  try {
    const { workModel } = req.body;
    if (!['whatsapp', 'card_checkout'].includes(workModel)) {
      return res.status(400).json({ message: 'Invalid work model. Must be "whatsapp" or "card_checkout"' });
    }

    const doc = await Setting.findOneAndUpdate(
      { key: 'work_model' },
      { key: 'work_model', value: workModel },
      { new: true, upsert: true }
    );

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'update_work_model',
      message: `Switched store work model to ${workModel}`,
      details: { workModel }
    });

    res.json({ success: true, workModel: doc.value });
  } catch (error) {
    console.error('updateWorkModel error:', error);
    res.status(500).json({ message: 'Failed to update work model' });
  }
};

// Admin endpoint: update payment gateway settings and credentials
exports.updatePaymentSettings = async (req, res) => {
  try {
    const incoming = req.body.paymentSettings || req.body;
    const existing = await Setting.findOne({ key: 'payment_settings' });
    const currentVal = existing?.value || DEFAULT_PAYMENT_SETTINGS;

    const merged = {
      ...currentVal,
      ...incoming,
      paymob: {
        ...(currentVal.paymob || {}),
        ...(incoming.paymob || {})
      },
      stripe: {
        ...(currentVal.stripe || {}),
        ...(incoming.stripe || {})
      }
    };

    const doc = await Setting.findOneAndUpdate(
      { key: 'payment_settings' },
      { key: 'payment_settings', value: merged },
      { new: true, upsert: true }
    );

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'update_payment_settings',
      message: `Updated payment gateway settings (Gateway: ${merged.activeGateway})`,
      details: { activeGateway: merged.activeGateway, enableCOD: merged.enableCOD }
    });

    res.json({ success: true, paymentSettings: doc.value });
  } catch (error) {
    console.error('updatePaymentSettings error:', error);
    res.status(500).json({ message: 'Failed to update payment settings' });
  }
};
