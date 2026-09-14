const express = require('express');
const router = express.Router();
const {
  getPublicSettings,
  getAdminSettings,
  updateWorkModel,
  updatePaymentSettings
} = require('../controllers/settingController');
const { protect, authorize } = require('../middleware/auth');

// Public settings route (no auth needed)
router.get('/public', getPublicSettings);

// Admin-only settings routes
router.get('/admin', protect, authorize('admin', 'superadmin'), getAdminSettings);
router.put('/work-model', protect, authorize('admin', 'superadmin'), updateWorkModel);
router.put('/payment-settings', protect, authorize('superadmin'), updatePaymentSettings);

module.exports = router;
