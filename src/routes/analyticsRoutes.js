const express = require('express');
const router = express.Router();
const { trackEvent, getSummary, getUnknownIPs } = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');

// Public — anyone can fire an event (rate limiting applied globally)
router.post('/event', trackEvent);

// Admin only — get aggregated analytics summary
router.get('/summary', protect, authorize('admin', 'staff', 'superadmin'), getSummary);

// Admin only — get unknown IP details for debugging
router.get('/unknown-ips', protect, authorize('admin', 'staff', 'superadmin'), getUnknownIPs);

module.exports = router;
