const express = require('express');
const router = express.Router();
const {
  initiateCheckout,
  verifyPayment,
  handleWebhook
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validate');

// Customer checkout initiation
router.post('/initiate', protect, initiateCheckout);

// Verify payment completion
router.post('/verify/:orderId', validateObjectId, protect, verifyPayment);

// Gateway Webhook callback (No HMAC integrity check since it comes from third party gateways)
router.post('/webhook', handleWebhook);

module.exports = router;
