const jwt = require('jsonwebtoken');
const User = require('../models/User');

const WARDEN_ALLOWLIST_USERNAMES = ['muthu@123'];

const FACULTY_ALLOWLIST_USERNAMES = [];

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
    if (req.user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Your Warden account is set to Inactive.'
      });
    }
    return next();
  }

  return res.status(403).json({
    success: false,
    message: '403 Forbidden: Access Denied. Only Warden accounts are granted access.'
  });
};

const protectFacultyAllowlist = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authorized, no user session found.' });
  }

  if (req.user.role === 'faculty') {
    if (req.user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Your Faculty Advisor account is set to Inactive.'
      });
    }
    return next();
  }

  return res.status(403).json({
    success: false,
    message: '403 Forbidden: Access Denied. Only Faculty Advisor accounts are granted access.'
  });
};

const protectStaffOrFaculty = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authorized, no user session found.' });
  }

  if (['staff', 'faculty', 'admin'].includes(req.user.role)) {
    if (req.user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Your account is currently inactive. Please contact Administrator.'
      });
    }
    return next();
  }

  return res.status(403).json({
    success: false,
    message: '403 Forbidden: Access Denied. Only Faculty Advisors and Wardens are granted access.'
  });
};

module.exports = {
  protect,
  protectWarden: protectWardenAllowlist,
  protectFaculty: protectFacultyAllowlist,
  protectWardenAllowlist,
  protectFacultyAllowlist,
  protectStaffOrFaculty,
  WARDEN_ALLOWLIST_USERNAMES,
  FACULTY_ALLOWLIST_USERNAMES
};
