const Banner = require('../models/Banner');
const Newsletter = require('../models/Newsletter');
const Setting = require('../models/Setting');
const { pick } = require('../middleware/validate');
const { recordAuditLog } = require('../utils/audit');

const ALLOWED_BANNER_FIELDS = ['title', 'subtitle', 'ctaText', 'ctaLink', 'imageUrl', 'position', 'isActive', 'startDate', 'endDate', 'order'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.getActiveBanners = async (req, res) => {
  try {
    const now = new Date();
    const banners = await Banner.find({
      isActive: true,
      $or: [
        { startDate: { $lte: now }, endDate: { $gte: now } },
        { startDate: null, endDate: null }
      ]
    }).sort({ order: 1 });
    
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ order: 1 });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createBanner = async (req, res) => {
  try {
    const banner = await Banner.create(pick(req.body, ALLOWED_BANNER_FIELDS));

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'create_banner',
      message: `Created banner ${banner.title || banner.position}`,
      details: { bannerId: banner._id, bannerTitle: banner.title, position: banner.position }
    });

    res.status(201).json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndUpdate(req.params.id, pick(req.body, ALLOWED_BANNER_FIELDS), { new: true });
    
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'update_banner',
      message: `Updated banner ${banner.title || banner.position}`,
      details: { bannerId: banner._id, bannerTitle: banner.title, position: banner.position }
    });

    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'delete_banner',
      message: `Deleted banner ${banner.title || banner.position}`,
      details: { bannerId: banner._id, bannerTitle: banner.title, position: banner.position }
    });

    res.json({ message: 'Banner deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.subscribeNewsletter = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }
    
    const existing = await Newsletter.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Already subscribed' });
    }

    await Newsletter.create({ email });
    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAnnouncement = async (req, res) => {
  try {
    let setting = await Setting.findOne({ key: 'announcement' });
    if (!setting) {
      setting = {
        key: 'announcement',
        value: {
          textEn: 'Free delivery for orders over 2000 EGP',
          textAr: 'توصيل مجاني للطلبات الأكثر من ٢٠٠٠ جنيه'
        }
      };
    }
    res.json(setting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateAnnouncement = async (req, res) => {
  try {
    const { textEn, textAr } = req.body;

    const setting = await Setting.findOneAndUpdate(
      { key: 'announcement' },
      { key: 'announcement', value: { textEn, textAr } },
      { new: true, upsert: true }
    );

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'update_announcement',
      message: `Updated announcement bar text`,
      details: { textEn, textAr }
    });

    res.json(setting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getHeroImage = async (req, res) => {
  try {
    let setting = await Setting.findOne({ key: 'hero_image' });
    if (!setting) {
      setting = {
        key: 'hero_image',
        value: { imageUrl: null, mobileImageUrl: null }
      };
    }
    res.json(setting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateHeroImage = async (req, res) => {
  try {
    const { imageUrl, mobileImageUrl } = req.body;

    const setting = await Setting.findOneAndUpdate(
      { key: 'hero_image' },
      { key: 'hero_image', value: { imageUrl, mobileImageUrl } },
      { new: true, upsert: true }
    );

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'update_hero_image',
      message: `Updated hero image`,
      details: { imageUrl, mobileImageUrl }
    });

    res.json(setting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
