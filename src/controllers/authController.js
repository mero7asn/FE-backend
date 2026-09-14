const User = require('../models/User');
const SoldProduct = require('../models/SoldProduct');
const Order = require('../models/Order');
const AuditLog = require('../models/AuditLog');
const { generateToken } = require('../utils/jwt');
const { recordAuditLog } = require('../utils/audit');
const { formatEgyptPhone } = require('../utils/uoo');

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      permissions: user.permissions,
      token
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('getProfile error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch profile' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (req.body.name) user.name = req.body.name;
    if (req.body.phone) user.phone = req.body.phone;
    if (req.body.addresses) user.addresses = req.body.addresses;

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: 'Invalid current password' });
    }

    user.password = newPassword;
    await user.save();

    await recordAuditLog({
      actor: req.user._id,
      targetUser: req.user._id,
      action: 'password_change',
      message: 'User changed own password',
      details: { email: user.email }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAdminUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ['admin', 'staff', 'superadmin'] } })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createAdminUser = async (req, res) => {
  try {
    const { name, email, password, role, permissions = [] } = req.body;
    const allowedRoles = ['admin', 'staff'];

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Role must be admin or staff' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({ name, email, password, role, status: 'active', permissions });

    await recordAuditLog({
      actor: req.user._id,
      targetUser: user._id,
      action: 'create_user',
      message: `Created ${role} account for ${email}`,
      details: { role, email, permissions }
    });

    const responseUser = user.toObject();
    delete responseUser.password;

    res.status(201).json(responseUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const allowedRoles = ['customer', 'staff', 'admin'];
    const { role } = req.body;

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (target.role === 'superadmin' && !req.user._id.equals(target._id)) {
      return res.status(403).json({ message: 'Cannot change another superadmin account' });
    }

    const previousRole = target.role;
    target.role = role;
    await target.save();

    await recordAuditLog({
      actor: req.user._id,
      targetUser: target._id,
      action: 'role_change',
      message: `Changed ${target.email} role from ${previousRole} to ${role}`,
      details: { previousRole, updatedRole: role }
    });

    res.json(target);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.toggleUserActive = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user._id.equals(target._id)) {
      return res.status(403).json({ message: 'Cannot modify your own active status' });
    }

    if (target.role === 'superadmin' && !req.user._id.equals(target._id)) {
      return res.status(403).json({ message: 'Cannot modify another superadmin account' });
    }

    target.isActive = !target.isActive;
    await target.save();

    await recordAuditLog({
      actor: req.user._id,
      targetUser: target._id,
      action: target.isActive ? 'unban_user' : 'ban_user',
      message: `${target.isActive ? 'Unbanned' : 'Banned'} ${target.email}`,
      details: { isActive: target.isActive }
    });

    res.json(target);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user._id.equals(target._id)) {
      return res.status(403).json({ message: 'Cannot delete your own account' });
    }

    if (target.role === 'superadmin' && !req.user._id.equals(target._id)) {
      return res.status(403).json({ message: 'Cannot delete another superadmin account' });
    }

    await target.deleteOne();

    await recordAuditLog({
      actor: req.user._id,
      targetUser: target._id,
      action: 'delete_user',
      message: `Deleted ${target.email}`,
      details: { role: target.role, email: target.email }
    });

    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const VALID_STATUSES = ['active', 'held', 'banned'];

exports.updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be active, held, or banned.' });
    }

    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user._id.equals(target._id)) {
      return res.status(403).json({ message: 'Cannot modify your own status' });
    }

    if (target.role === 'superadmin' && !req.user._id.equals(target._id)) {
      return res.status(403).json({ message: 'Cannot modify another superadmin account' });
    }

    const previousStatus = target.status;
    target.status = status;
    await target.save();

    await recordAuditLog({
      actor: req.user._id,
      targetUser: target._id,
      action: 'status_change',
      message: `Changed ${target.email} status from ${previousStatus} to ${status}`,
      details: { previousStatus, updatedStatus: status }
    });

    res.json(target);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const VALID_PERMISSIONS = [
  'products_create', 'products_edit', 'products_delete', 'products_view',
  'orders_view', 'orders_update',
  'drops_create', 'drops_edit', 'drops_delete',
  'coupons_create', 'coupons_edit', 'coupons_delete',
  'banners_create', 'banners_edit', 'banners_delete',
  'users_manage', 'analytics_view', 'logs_view'
];

exports.updateUserPermissions = async (req, res) => {
  try {
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: 'Permissions must be an array' });
    }

    const invalidPerms = permissions.filter(p => !VALID_PERMISSIONS.includes(p));
    if (invalidPerms.length > 0) {
      return res.status(400).json({ message: `Invalid permissions: ${invalidPerms.join(', ')}` });
    }

    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (target.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot modify superadmin permissions' });
    }

    if (target.role === 'customer' && permissions.length > 0) {
      return res.status(400).json({ message: 'Customers cannot have admin permissions' });
    }

    const previousPerms = target.permissions || [];
    target.permissions = permissions;
    await target.save();

    await recordAuditLog({
      actor: req.user._id,
      targetUser: target._id,
      action: 'permissions_update',
      message: `Updated permissions for ${target.email}`,
      details: { previousPermissions: previousPerms, updatedPermissions: permissions }
    });

    res.json(target);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate('actor', 'name email role')
      .populate('targetUser', 'name email role')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();
    res.json(logs);
  } catch (error) {
    console.error('getLogs error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch logs' });
  }
};

exports.addToWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { productId } = req.body;

    if (!user.wishlist.includes(productId)) {
      user.wishlist.push(productId);
      await user.save();
    }

    res.json(user.wishlist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.wishlist = (user.wishlist || []).filter(id => id.toString() !== req.params.productId);
    await user.save();
    res.json(user.wishlist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Customer: Get my digital UUO Authenticity Cards
exports.getMyCards = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // A customer can ONLY see cards if they have actually bought products:
    // 1. Directly linked to their buyer user ID (online checkout)
    // 2. Or linked to orders placed by this user account in the Order collection
    const conditions = [
      { buyerUserId: user._id }
    ];

    // Find confirmed/valid orders placed by this specific user account
    const userOrders = await Order.find({ 
      user: user._id, 
      status: { $in: ['paid', 'processing', 'shipped', 'delivered', 'completed'] } 
    }).select('_id shippingAddress');

    const orderIds = userOrders.map(o => o._id);
    if (orderIds.length > 0) {
      conditions.push({ order: { $in: orderIds } });

      const phonesChecked = new Set();
      for (const ord of userOrders) {
        if (ord.shippingAddress?.phone) {
          const rawPhone = ord.shippingAddress.phone.trim();
          const formattedPhone = formatEgyptPhone(rawPhone);
          if (rawPhone && !phonesChecked.has(rawPhone)) {
            conditions.push({ customerPhone: rawPhone });
            phonesChecked.add(rawPhone);
          }
          if (formattedPhone && formattedPhone !== rawPhone && !phonesChecked.has(formattedPhone)) {
            conditions.push({ customerPhone: formattedPhone });
            phonesChecked.add(formattedPhone);
          }
        }
      }
    }

    const cards = await SoldProduct.find({
      isDeleted: { $ne: true },
      $or: conditions
    })
      .populate('product', 'name images price category description productNumber')
      .sort({ createdAt: -1 });

    res.json(cards);
  } catch (error) {
    console.error('getMyCards error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch UUO cards' });
  }
};

