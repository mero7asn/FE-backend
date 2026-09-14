const express = require('express');
const router = express.Router();
const { getActiveBanners, getAllBanners, createBanner, updateBanner, deleteBanner, subscribeNewsletter, getAnnouncement, updateAnnouncement, getHeroImage, updateHeroImage } = require('../controllers/cmsController');
const { protect, authorize, checkPermission } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validate');

router.get('/banners/active', getActiveBanners);
router.get('/banners', protect, authorize('admin', 'staff'), getAllBanners);
router.post('/banners', protect, authorize('admin', 'staff'), checkPermission('banners_create'), createBanner);
router.put('/banners/:id', validateObjectId, protect, authorize('admin', 'staff'), checkPermission('banners_edit'), updateBanner);
router.delete('/banners/:id', validateObjectId, protect, authorize('admin'), checkPermission('banners_delete'), deleteBanner);
router.post('/newsletter', subscribeNewsletter);

router.get('/announcement', getAnnouncement);
router.put('/announcement', protect, authorize('superadmin'), updateAnnouncement);

router.get('/hero-image', getHeroImage);
router.put('/hero-image', protect, authorize('superadmin'), updateHeroImage);

module.exports = router;
