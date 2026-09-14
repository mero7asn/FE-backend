const express = require('express');
const router = express.Router();
const { createOrder, getMyOrders, getOrder, getAllOrders, updateOrderStatus, getOrderStats } = require('../controllers/orderController');
const { protect, authorize, checkPermission } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validate');

router.post('/', protect, createOrder);
router.get('/my-orders', protect, getMyOrders);
router.get('/stats', protect, authorize('admin', 'staff'), checkPermission('analytics_view'), getOrderStats);
router.get('/', protect, authorize('admin', 'staff'), checkPermission('orders_view'), getAllOrders);
router.get('/:id', validateObjectId, protect, getOrder);
router.put('/:id', validateObjectId, protect, authorize('admin', 'staff'), checkPermission('orders_update'), updateOrderStatus);

module.exports = router;
