const jwt = require('jsonwebtoken');
const User = require('../models/User');

const WARDEN_ALLOWLIST_USERNAMES = ['muthu@123', 'rajesh@123', 'deva@123', 'prince@123'];

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'gces_kaveri_hostel_secret_key');
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }
      return next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Not authorized, token invalid or expired' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }
};

const protectWardenAllowlist = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authorized, no user session found.' });
  }

  if (['staff', 'admin'].includes(req.user.role)) {
    const uname = (req.user.username || '').trim().toLowerCase();
    const staffId = (req.user.staffId || '').trim().toLowerCase();

    if (!WARDEN_ALLOWLIST_USERNAMES.includes(uname) && !WARDEN_ALLOWLIST_USERNAMES.includes(staffId)) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Access Denied. Only pre-authorized 4 Warden/Admin accounts are granted access.'
      });
    }
  }

  next();
};

module.exports = { protect, protectWardenAllowlist, WARDEN_ALLOWLIST_USERNAMES };
