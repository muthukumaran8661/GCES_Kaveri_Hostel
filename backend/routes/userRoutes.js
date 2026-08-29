const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, protectWardenAllowlist } = require('../middleware/authMiddleware');

// @route   PUT /api/users/profile
// @desc    Update user profile details (e.g. homeAddress, department, year)
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { homeAddress, department, year } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (homeAddress !== undefined) {
      user.homeAddress = homeAddress.trim();
    }
    
    // Protect department and year from student-side updates
    if (user.role !== 'student') {
      if (department !== undefined) {
        user.department = department.trim();
      }
      if (year !== undefined) {
        user.year = year.trim();
      }
    }

    await user.save();

    return res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        reg: user.reg,
        room: user.room,
        studentId: user.studentId,
        staffId: user.staffId,
        designation: user.designation,
        department: user.department || '',
        year: user.year || '',
        status: user.status || 'active',
        homeAddress: user.homeAddress
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
});

const WARDEN_USERNAMES = ['muthu@123', 'rajesh@123', 'deva@123', 'prince@123'];

const DEPT_ORDER = {
  'cse': 1,
  'ece': 2,
  'eee': 3,
  'mechanical': 4,
  'mech': 4,
  'civil': 5,
  'mechatronics': 6
};

function getWardenRank(u) {
  const uname = (u.username || u.staffId || '').toLowerCase();
  const name = (u.name || '').toLowerCase();
  if (uname.includes('muthu') || name.includes('muthukumaran')) return 1;
  if (uname.includes('rajesh') || name.includes('rajesh')) return 2;
  if (uname.includes('deva') || name.includes('deva')) return 3;
  if (uname.includes('prince') || name.includes('prince')) return 4;
  return 99;
}

function getYearRank(y) {
  if (!y) return 99;
  const s = String(y).trim();
  if (/^I(\s+Year)?$/i.test(s) || /^1(st)?(\s+Year)?$/i.test(s)) return 1;
  if (/^II(\s+Year)?$/i.test(s) || /^2(nd)?(\s+Year)?$/i.test(s)) return 2;
  if (/^III(\s+Year)?$/i.test(s) || /^3(rd)?(\s+Year)?$/i.test(s)) return 3;
  if (/^IV(\s+Year)?$/i.test(s) || /^4(th)?(\s+Year)?$/i.test(s)) return 4;
  return 99;
}

function sortStaffUsers(users) {
  if (!Array.isArray(users)) return [];
  return [...users].sort((a, b) => {
    const unameA = (a.username || a.staffId || '').toLowerCase();
    const unameB = (b.username || b.staffId || '').toLowerCase();
    const isWardenA = a.role === 'staff' || a.role === 'admin' || (a.department || '').toLowerCase() === 'hostel administration' || WARDEN_USERNAMES.includes(unameA);
    const isWardenB = b.role === 'staff' || b.role === 'admin' || (b.department || '').toLowerCase() === 'hostel administration' || WARDEN_USERNAMES.includes(unameB);

    // Rule 1: Wardens MUST display first
    if (isWardenA && !isWardenB) return -1;
    if (!isWardenA && isWardenB) return 1;

    // If both are Wardens, sort in fixed order: Muthukumaran G -> Rajesh P -> Deva N -> Prince P
    if (isWardenA && isWardenB) {
      return getWardenRank(a) - getWardenRank(b);
    }

    // Rule 2: Faculty Advisors - sort by Department (CSE -> ECE -> EEE -> Mechanical -> Civil -> Mechatronics)
    const deptA = DEPT_ORDER[(a.department || '').toLowerCase()] || 99;
    const deptB = DEPT_ORDER[(b.department || '').toLowerCase()] || 99;
    if (deptA !== deptB) return deptA - deptB;

    // Rule 3: Within same Department, sort by Year (I Year -> II Year -> III Year -> IV Year)
    const yearA = getYearRank(a.year);
    const yearB = getYearRank(b.year);
    if (yearA !== yearB) return yearA - yearB;

    return (a.name || '').localeCompare(b.name || '');
  });
}

// @route   GET /api/users/staff-list
// @desc    Get list of all faculty and staff users for Admin management
// @access  Private (Staff/Faculty/Admin)
router.get('/staff-list', protect, protectWardenAllowlist, async (req, res) => {
  try {
    if (!['staff', 'faculty', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const rawUsers = await User.find({ role: { $in: ['faculty', 'staff', 'admin'] } })
      .select('-password');

    const users = sortStaffUsers(rawUsers);

    return res.json({ success: true, users });
  } catch (error) {
    console.error('Get staff list error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching staff list' });
  }
});

// @route   PUT /api/users/:id/admin-update
// @desc    Admin endpoint to update faculty/staff member's department, year, role, or status
// @access  Private (Staff/Admin)
function normalizeYearDisplay(y) {
  if (!y) return 'All Years';
  const s = String(y).trim();
  if (/^I(\s+Year)?$/i.test(s) || /^1(st)?(\s+Year)?$/i.test(s)) return 'I Year';
  if (/^II(\s+Year)?$/i.test(s) || /^2(nd)?(\s+Year)?$/i.test(s)) return 'II Year';
  if (/^III(\s+Year)?$/i.test(s) || /^3(rd)?(\s+Year)?$/i.test(s)) return 'III Year';
  if (/^IV(\s+Year)?$/i.test(s) || /^4(th)?(\s+Year)?$/i.test(s)) return 'IV Year';
  if (/ALL/i.test(s)) return 'All Years';
  return s;
}

// @route   PUT /api/users/:id/admin-update
// @desc    Admin endpoint to update faculty/staff member's department, year, role, or status
// @access  Private (Staff/Admin)
router.put('/:id/admin-update', protect, protectWardenAllowlist, async (req, res) => {
  try {
    if (!['staff', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Admin or Warden access required.' });
    }

    const { department, year, role, status, designation } = req.body;
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Faculty/Staff user not found.' });
    }

    if (role !== undefined) {
      const trimmedRole = role.trim();
      if (!['faculty', 'staff'].includes(trimmedRole)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Permission management allows only "Faculty Advisor" or "Warden".'
        });
      }
      targetUser.role = trimmedRole;
    }
    if (year !== undefined) targetUser.year = year.trim();
    if (status !== undefined) targetUser.status = status.trim();

    if (['staff', 'admin'].includes(targetUser.role)) {
      targetUser.department = 'Hostel Administration';
      const normY = normalizeYearDisplay(targetUser.year);
      targetUser.designation = designation ? designation.trim() : (normY && normY !== 'All Years' ? `${normY} Warden` : 'Warden');
    } else if (targetUser.role === 'faculty') {
      if (department !== undefined) {
        targetUser.department = department.trim();
      } else if (targetUser.department === 'Hostel Administration') {
        targetUser.department = 'CSE';
      }
      const normY = normalizeYearDisplay(targetUser.year);
      targetUser.designation = designation ? designation.trim() : (normY && normY !== 'All Years' ? `${normY} ${targetUser.department || ''} Faculty Advisor` : 'Faculty Advisor');
    }

    await targetUser.save();

    return res.json({
      success: true,
      message: `Updated permissions for ${targetUser.name || targetUser.username}`,
      user: {
        id: targetUser._id,
        username: targetUser.username,
        role: targetUser.role,
        name: targetUser.name,
        staffId: targetUser.staffId,
        designation: targetUser.designation,
        department: targetUser.department,
        year: targetUser.year,
        status: targetUser.status,
        email: targetUser.email || '',
        phone: targetUser.phone || '',
        homeAddress: targetUser.homeAddress || ''
      }
    });
  } catch (error) {
    console.error('Admin update user error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating user permissions' });
  }
});

module.exports = router;
