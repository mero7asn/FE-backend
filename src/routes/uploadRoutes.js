const express = require('express');
const router = express.Router();
const multer = require('multer');
const { put } = require('@vercel/blob');
const { protect, authorize } = require('../middleware/auth');

// Store files in memory so we can upload them directly to Vercel Blob
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only images allowed'));
  }
});

router.post('/', protect, authorize('admin', 'staff'), upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No images provided' });
    }

    const uploadPromises = req.files.map(async (file) => {
      // Generate a safe, unique filename
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `${Date.now()}-${safeName}`;

      // Upload to Vercel Blob
      const blob = await put(filename, file.buffer, {
        access: 'public',
        contentType: file.mimetype,
      });

      return {
        url: blob.url,
        alt: file.originalname,
        isPrimary: false
      };
    });

    const urls = await Promise.all(uploadPromises);
    res.json(urls);
  } catch (error) {
    console.error('Error uploading to Vercel Blob:', error);
    res.status(500).json({ message: 'Error uploading images', error: error.message });
  }
});

module.exports = router;
