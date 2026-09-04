const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const Staff = require('../models/Staff');
const Warden = require('../models/Warden');
const User = require('../models/User'); // fallback for migration safety

const WARDEN_ALLOWLIST_USERNAMES = ['muthu@123'];
const FACULTY_ALLOWLIST_USERNAMES = [];

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'gces_kaveri_hostel_secret_key');
      const userId = decoded.id || decoded.userId;

      let foundUser = null;
      let userRole = decoded.role ? String(decoded.role).toLowerCase() : null;

      // 1. Role-directed lookup first
      if (userRole === 'student') {
        foundUser = await Student.findById(userId).select('-password');
      } else if (userRole === 'faculty' || userRole === 'faculty advisor') {
        foundUser = await Staff.findById(userId).select('-password');
      } else if (userRole === 'warden' || userRole === 'staff' || userRole === 'admin') {
        foundUser = await Warden.findById(userId).select('-password');
      }

      // 2. Fallback search across all collections if not found by role-hint
      if (!foundUser) {
        foundUser = await Student.findById(userId).select('-password');
      }
      if (!foundUser) {
        foundUser = await Staff.findById(userId).select('-password');
      }
      if (!foundUser) {
        foundUser = await Warden.findById(userId).select('-password');
      }
      if (!foundUser) {
        // Last-resort fallback to legacy User collection
        foundUser = await User.findById(userId).select('-password');
      }

      if (!foundUser) {
        return res.status(401).json({ success: false, message: 'User not found.' });
      }

      // 3. Normalize user attributes for seamless compatibility across application
      const rawObj = foundUser.toObject ? foundUser.toObject() : foundUser;
      const effectiveRole = String(rawObj.role || '').toLowerCase();

      let normalizedRole = 'student';
      if (effectiveRole === 'admin') {
        normalizedRole = 'admin';
      } else if (['faculty', 'faculty advisor'].includes(effectiveRole) || foundUser.collection.name === 'staff') {
        normalizedRole = 'faculty';
      } else if (['staff', 'warden'].includes(effectiveRole) || foundUser.collection.name === 'wardens') {
        normalizedRole = 'staff';
      }

      const assignedYear = rawObj.assignedYear || rawObj.year || '';

      req.user = {
        ...rawObj,
        _id: foundUser._id,
        id: foundUser._id,
        role: normalizedRole,
        originalRole: rawObj.role,
        assignedYear,
        year: assignedYear,
        department: rawObj.department || ''
      };

      return next();
    } catch (error) {
      console.error('Auth middleware token error:', error.message);
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

  const role = (req.user.role || '').toLowerCase();
  const origRole = (req.user.originalRole || '').toLowerCase();

  if (role === 'staff' || role === 'admin' || origRole === 'warden' || origRole === 'staff' || origRole === 'admin') {
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

  const role = (req.user.role || '').toLowerCase();
  const origRole = (req.user.originalRole || '').toLowerCase();

  if (role === 'faculty' || origRole === 'faculty advisor' || origRole === 'faculty') {
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

  const role = (req.user.role || '').toLowerCase();
  const origRole = (req.user.originalRole || '').toLowerCase();
  const allowed = ['staff', 'faculty', 'admin', 'warden', 'faculty advisor'];

  if (allowed.includes(role) || allowed.includes(origRole)) {
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
