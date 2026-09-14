const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const decoded = verifyToken(token);
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (req.user.status === 'banned') {
      return res.status(403).json({ message: 'Account is banned' });
    }

    if (req.user.status === 'held') {
      return res.status(403).json({ message: 'Account is on hold. Contact support.' });
    }

    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, invalid token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    // superadmin always has full access, regardless of listed roles
    if (req.user.role === 'superadmin') return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

const checkPermission = (permission) => {
  return (req, res, next) => {
    // superadmin and admin always have all permissions
    if (req.user.role === 'superadmin' || req.user.role === 'admin') return next();
    // staff check their permissions array
    if (req.user.role === 'staff') {
      if (req.user.permissions?.includes(permission)) return next();
    }
    return res.status(403).json({ message: 'Insufficient permissions' });
  };
};

module.exports = { protect, authorize, checkPermission };
