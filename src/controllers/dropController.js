const Drop = require('../models/Drop');
const { pick } = require('../middleware/validate');
const { recordAuditLog } = require('../utils/audit');

const ALLOWED_DROP_FIELDS = ['title', 'description', 'products', 'launchDate', 'status', 'slug'];

exports.getAllDrops = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    
    const drops = await Drop.find(filter).populate('products').sort({ launchDate: -1 });
    res.json(drops);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDrop = async (req, res) => {
  try {
    const drop = await Drop.findOne({
      $or: [{ _id: req.params.id }, { slug: req.params.id }]
    }).populate('products');

    if (!drop) {
      return res.status(404).json({ message: 'Drop not found' });
    }

    res.json(drop);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createDrop = async (req, res) => {
  try {
    const drop = await Drop.create(pick(req.body, ALLOWED_DROP_FIELDS));

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'create_drop',
      message: `Created drop ${drop.title}`,
      details: { dropId: drop._id, dropTitle: drop.title }
    });

    res.status(201).json(drop);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateDrop = async (req, res) => {
  try {
    const drop = await Drop.findByIdAndUpdate(req.params.id, pick(req.body, ALLOWED_DROP_FIELDS), { new: true, runValidators: true });
    
    if (!drop) {
      return res.status(404).json({ message: 'Drop not found' });
    }

    drop.updateStatus();
    await drop.save();

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'update_drop',
      message: `Updated drop ${drop.title}`,
      details: { dropId: drop._id, dropTitle: drop.title }
    });

    res.json(drop);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteDrop = async (req, res) => {
  try {
    const drop = await Drop.findByIdAndDelete(req.params.id);
    
    if (!drop) {
      return res.status(404).json({ message: 'Drop not found' });
    }

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'delete_drop',
      message: `Deleted drop ${drop.title}`,
      details: { dropId: drop._id, dropTitle: drop.title }
    });

    res.json({ message: 'Drop deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.subscribeToNotification = async (req, res) => {
  try {
    const drop = await Drop.findById(req.params.id);
    
    if (!drop) {
      return res.status(404).json({ message: 'Drop not found' });
    }

    if (!drop.notifySubscribers.includes(req.user._id)) {
      drop.notifySubscribers.push(req.user._id);
      await drop.save();
    }

    res.json({ message: 'Subscribed to notifications' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.launchDrop = async (req, res) => {
  try {
    const drop = await Drop.findById(req.params.id);
    
    if (!drop) {
      return res.status(404).json({ message: 'Drop not found' });
    }

    drop.status = 'live';
    await drop.save();

    await recordAuditLog({
      actor: req.user._id,
      targetUser: null,
      action: 'launch_drop',
      message: `Launched drop ${drop.title}`,
      details: { dropId: drop._id, dropTitle: drop.title }
    });

    res.json(drop);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
