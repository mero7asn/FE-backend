const express = require('express');
const router = express.Router();
const { generateSalesReportExcel, getCustomerRanking, exportCustomerRankingExcel, generateSingleCustomerExcel } = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

// All report routes are STRICTLY restricted to superadmin only
router.get('/excel', protect, authorize('superadmin'), generateSalesReportExcel);
router.get('/customer-ranking', protect, authorize('superadmin'), getCustomerRanking);
router.get('/customer-ranking/export', protect, authorize('superadmin'), exportCustomerRankingExcel);
router.get('/customer-excel', protect, authorize('superadmin'), generateSingleCustomerExcel);

module.exports = router;
