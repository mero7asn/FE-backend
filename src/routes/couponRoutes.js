const express = require('express');
const router = express.Router();
const { validateCoupon, getAllCoupons, createCoupon, updateCoupon, deleteCoupon } = require('../controllers/couponController');
const { protect, authorize, checkPermission } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validate');

router.post('/validate', protect, validateCoupon);
router.get('/', protect, authorize('admin', 'staff'), getAllCoupons);
router.post('/', protect, authorize('admin', 'staff'), checkPermission('coupons_create'), createCoupon);
router.put('/:id', validateObjectId, protect, authorize('admin', 'staff'), checkPermission('coupons_edit'), updateCoupon);
router.delete('/:id', validateObjectId, protect, authorize('admin'), checkPermission('coupons_delete'), deleteCoupon);

module.exports = router;
