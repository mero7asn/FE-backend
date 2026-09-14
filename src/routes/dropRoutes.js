const express = require('express');
const router = express.Router();
const { getAllDrops, getDrop, createDrop, updateDrop, deleteDrop, subscribeToNotification, launchDrop } = require('../controllers/dropController');
const { protect, authorize, checkPermission } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validate');

router.get('/', getAllDrops);
router.get('/:id', validateObjectId, getDrop);
router.post('/', protect, authorize('admin', 'staff'), checkPermission('drops_create'), createDrop);
router.put('/:id', validateObjectId, protect, authorize('admin', 'staff'), checkPermission('drops_edit'), updateDrop);
router.delete('/:id', validateObjectId, protect, authorize('admin'), checkPermission('drops_delete'), deleteDrop);
router.post('/:id/subscribe', validateObjectId, protect, subscribeToNotification);
router.post('/:id/launch', validateObjectId, protect, authorize('admin'), checkPermission('drops_edit'), launchDrop);

module.exports = router;
