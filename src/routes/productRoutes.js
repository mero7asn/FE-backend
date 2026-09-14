const express = require('express');
const router = express.Router();
const { getAllProducts, getProduct, createProduct, updateProduct, deleteProduct, getFeaturedProducts, toggleAvailability, sellProductItem, getAllSoldProducts, getSoldProduct, verifySoldProduct, getRecommendations, updateSoldProductCustomer, deleteSoldProduct, restoreSoldProduct } = require('../controllers/productController');
const { protect, authorize, checkPermission } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validate');

router.get('/', getAllProducts);
router.get('/featured', getFeaturedProducts);
router.post('/verify-uoo', verifySoldProduct);
router.get('/recommendations', getRecommendations);
router.get('/sold', protect, authorize('admin'), getAllSoldProducts);
router.get('/sold/:id', protect, authorize('admin'), getSoldProduct);
router.patch('/sold/:id/customer', validateObjectId, protect, authorize('admin'), checkPermission('products_view'), updateSoldProductCustomer);
router.delete('/sold/:id', validateObjectId, protect, authorize('admin'), deleteSoldProduct);
router.patch('/sold/:id/restore', validateObjectId, protect, authorize('admin'), restoreSoldProduct);
router.get('/:id', validateObjectId, getProduct);
router.post('/', protect, authorize('admin', 'staff'), checkPermission('products_create'), createProduct);
router.put('/:id', validateObjectId, protect, authorize('admin', 'staff'), checkPermission('products_edit'), updateProduct);
router.patch('/:id/toggle-availability', validateObjectId, protect, authorize('admin', 'staff'), checkPermission('products_edit'), toggleAvailability);
router.post('/:id/sell', validateObjectId, protect, authorize('admin'), checkPermission('products_view'), sellProductItem);
router.delete('/:id', validateObjectId, protect, authorize('admin'), checkPermission('products_delete'), deleteProduct);

module.exports = router;
