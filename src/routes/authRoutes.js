const express = require('express');
const router = express.Router();
const { register, login, getProfile, updateProfile, addToWishlist, removeFromWishlist,
  changePassword, getAdminUsers, createAdminUser, updateUserRole, updateUserStatus, updateUserPermissions, toggleUserActive, deleteUser, getLogs, getMyCards } = require('../controllers/authController');
const { protect, authorize, checkPermission } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validate');

router.post('/register', register);
router.post('/login', login);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.get('/my-cards', protect, getMyCards);
router.put('/password', protect, changePassword);
router.get('/users', protect, authorize('superadmin'), getAdminUsers);
router.post('/users', protect, authorize('superadmin'), createAdminUser);
router.put('/users/:id/role', validateObjectId, protect, authorize('superadmin'), updateUserRole);
router.put('/users/:id/status', validateObjectId, protect, authorize('superadmin'), updateUserStatus);
router.put('/users/:id/permissions', validateObjectId, protect, authorize('superadmin'), updateUserPermissions);
router.put('/users/:id/toggle-active', validateObjectId, protect, authorize('superadmin'), toggleUserActive);
router.delete('/users/:id', validateObjectId, protect, authorize('superadmin'), deleteUser);
router.get('/logs', protect, checkPermission('logs_view'), getLogs);
router.post('/wishlist', protect, addToWishlist);
router.delete('/wishlist/:productId', validateObjectId, protect, removeFromWishlist);

module.exports = router;
