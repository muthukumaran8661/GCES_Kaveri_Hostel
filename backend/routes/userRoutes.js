const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Staff = require('../models/Staff');
const Warden = require('../models/Warden');
const User = require('../models/User');
const { protect, protectWardenAllowlist, protectStaffOrFaculty } = require('../middleware/authMiddleware');
const { normalizeDepartment, normalizeYear } = require('../utils/normalization');

// @route   PUT /api/users/profile
// @desc    Update user profile details (homeAddress, department, year)
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { homeAddress, department, year } = req.body;
    const userId = req.user._id || req.user.id;

    let user = await Student.findById(userId);
    let userModel = 'student';

    if (!user) {
      user = await Staff.findById(userId);
      userModel = 'staff';
    }
    if (!user) {
      user = await Warden.findById(userId);
      userModel = 'warden';
    }
    if (!user) {
      user = await User.findById(userId);
      userModel = 'legacy';
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (homeAddress !== undefined) {
      user.homeAddress = homeAddress.trim();
    }

    if (userModel === 'student' || user.role === 'student') {
      // ONLY Year is editable for students. All other fields (Department, Name, Reg, Email, etc.) are strictly read-only!
      if (year !== undefined) {
        user.year = normalizeYear(year);
      }
    } else {
      // Staff / Warden / Admin updates
      if (department !== undefined) {
        user.department = department.trim();
      }
      if (year !== undefined) {
        user.year = year.trim();
        if (user.assignedYear !== undefined) {
          user.assignedYear = year.trim();
        }
      }
    }

    await user.save();

    return res.json({
      success: true,
      user: {
        id: user._id,
        _id: user._id,
        username: user.username,
        role: req.user.role,
        name: user.name,
        reg: user.reg || user.registerNumber || '',
        room: user.room || '',
        studentId: user.studentId || '',
        staffId: user.staffId || '',
        designation: user.designation || '',
        department: user.department || '',
        year: user.assignedYear || user.year || '',
        status: user.status || 'active',
        homeAddress: user.homeAddress || ''
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
});

const WARDEN_USERNAMES = ['muthu@123'];

const DEPT_ORDER = {
  'cse': 1,
  'ece': 2,
  'eee': 3,
  'mechanical': 4,
  'mech': 4,
  'civil': 5,
  'mechatronics': 6,
  'chemistry': 7,
  'maths': 8,
  'physics': 9,
  'english': 10
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
    const isWardenA = a.role === 'staff' || a.role === 'admin' || a.role === 'Warden' || (a.department || '').toLowerCase() === 'hostel administration' || WARDEN_USERNAMES.includes(unameA);
    const isWardenB = b.role === 'staff' || b.role === 'admin' || b.role === 'Warden' || (b.department || '').toLowerCase() === 'hostel administration' || WARDEN_USERNAMES.includes(unameB);

    // Rule 1: Wardens MUST display first
    if (isWardenA && !isWardenB) return -1;
    if (!isWardenA && isWardenB) return 1;

    // If both are Wardens, sort in fixed order: Muthukumaran G -> Rajesh P -> Deva N -> Prince P
    if (isWardenA && isWardenB) {
      return getWardenRank(a) - getWardenRank(b);
    }

    // Rule 2: Faculty Advisors - sort by Department
    const deptA = DEPT_ORDER[(a.department || '').toLowerCase()] || 99;
    const deptB = DEPT_ORDER[(b.department || '').toLowerCase()] || 99;
    if (deptA !== deptB) return deptA - deptB;

    // Rule 3: Within same Department, sort by Year
    const yearA = getYearRank(a.year || a.assignedYear);
    const yearB = getYearRank(b.year || b.assignedYear);
    if (yearA !== yearB) return yearA - yearB;

    return (a.name || '').localeCompare(b.name || '');
  });
}

// @route   GET /api/users/staff-list
// @desc    Get list of all faculty and staff users for Admin management from staff and wardens collections
// @access  Private (Staff/Faculty/Admin)
router.get('/staff-list', protect, protectStaffOrFaculty, async (req, res) => {
  try {
    const role = (req.user.role || '').toLowerCase();
    const origRole = (req.user.originalRole || '').toLowerCase();
    const allowed = ['staff', 'faculty', 'admin', 'warden', 'faculty advisor'];
    if (!allowed.includes(role) && !allowed.includes(origRole)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const [rawStaff, rawWardens] = await Promise.all([
      Staff.find().select('-password').lean(),
      Warden.find().select('-password').lean()
    ]);

    // Normalize for frontend table rendering
    const staffList = rawStaff.map(s => ({
      ...s,
      role: 'faculty',
      year: s.assignedYear || s.year || 'I Year'
    }));

    const wardenList = rawWardens.map(w => ({
      ...w,
      role: w.role === 'admin' ? 'admin' : 'staff',
      year: w.assignedYear || w.year || 'All Years'
    }));

    const combined = [...wardenList, ...staffList];
    const users = sortStaffUsers(combined);

    return res.json({ success: true, users });
  } catch (error) {
    console.error('Get staff list error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching staff list' });
  }
});

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
    const { department, year, role, status, designation } = req.body;
    const targetId = req.params.id;

    // Search in Staff or Warden collection
    let targetStaff = await Staff.findById(targetId);
    let targetWarden = targetStaff ? null : await Warden.findById(targetId);

    if (!targetStaff && !targetWarden) {
      const legacyUser = await User.findById(targetId);
      if (legacyUser) {
        if (['faculty', 'faculty advisor'].includes((legacyUser.role || '').toLowerCase())) {
          targetStaff = legacyUser;
        } else {
          targetWarden = legacyUser;
        }
      }
    }

    if (!targetStaff && !targetWarden) {
      return res.status(404).json({ success: false, message: 'Faculty/Staff user not found.' });
    }

    const normYear = year !== undefined ? normalizeYear(year) : undefined;
    const normDept = department !== undefined ? normalizeDepartment(department.trim()) : undefined;
    const normStatus = status !== undefined ? status.trim() : undefined;

    if (targetStaff) {
      if (normDept) targetStaff.department = normDept;
      if (normYear) {
        targetStaff.year = normYear;
        targetStaff.assignedYear = normYear;
      }
      if (normStatus) targetStaff.status = normStatus;
      const displayY = normalizeYearDisplay(targetStaff.assignedYear || targetStaff.year);
      targetStaff.designation = designation ? designation.trim() : `${displayY} ${targetStaff.department} Faculty Advisor`;
      await targetStaff.save();

      return res.json({
        success: true,
        message: `Updated permissions for ${targetStaff.name || targetStaff.username}`,
        user: {
          id: targetStaff._id,
          _id: targetStaff._id,
          username: targetStaff.username,
          role: 'faculty',
          name: targetStaff.name,
          staffId: targetStaff.staffId,
          designation: targetStaff.designation,
          department: targetStaff.department,
          year: targetStaff.assignedYear || targetStaff.year,
          status: targetStaff.status,
          email: targetStaff.email || '',
          phone: targetStaff.phone || '',
          homeAddress: targetStaff.homeAddress || ''
        }
      });
    }

    if (targetWarden) {
      if (normDept) targetWarden.department = normDept;
      if (normYear) {
        targetWarden.year = normYear;
        targetWarden.assignedYear = normYear;
      }
      if (normStatus) targetWarden.status = normStatus;
      const displayY = normalizeYearDisplay(targetWarden.assignedYear || targetWarden.year);
      targetWarden.designation = designation ? designation.trim() : (displayY && displayY !== 'All Years' ? `${displayY} Warden` : 'Warden');
      await targetWarden.save();

      return res.json({
        success: true,
        message: `Updated permissions for ${targetWarden.name || targetWarden.username}`,
        user: {
          id: targetWarden._id,
          _id: targetWarden._id,
          username: targetWarden.username,
          role: targetWarden.role === 'admin' ? 'admin' : 'staff',
          name: targetWarden.name,
          staffId: targetWarden.staffId,
          designation: targetWarden.designation,
          department: targetWarden.department,
          year: targetWarden.assignedYear || targetWarden.year,
          status: targetWarden.status,
          email: targetWarden.email || '',
          phone: targetWarden.phone || '',
          homeAddress: targetWarden.homeAddress || ''
        }
      });
    }
  } catch (error) {
    console.error('Admin update user error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating user permissions' });
  }
});

// @route   POST /api/users/add-staff
// @desc    Admin endpoint to create a new Warden or Faculty Advisor account in staff/wardens collection
// @access  Private (Staff/Admin)
router.post('/add-staff', protect, protectWardenAllowlist, async (req, res) => {
  try {
    const { name, username, role, department, year, email, phone, password } = req.body;

    if (!name || !name.trim() ||
        !username || !username.trim() ||
        !role || !role.trim() ||
        !year || !year.trim() ||
        !email || !email.trim() ||
        !phone || !phone.trim() ||
        !password || !password.trim()) {
      return res.status(400).json({ success: false, message: 'All fields are required. Please fill in all details.' });
    }

    const normName = name.trim();
    const normUsername = username.trim().toLowerCase();
    const normRole = role.trim().toLowerCase();
    const normYear = normalizeYear(year);
    const normEmail = email.trim().toLowerCase();
    const normPhone = phone.trim();
    const rawPassword = password.trim();

    if (!['staff', 'faculty'].includes(normRole)) {
      return res.status(400).json({ success: false, message: 'Role must be either "Warden" (staff) or "Faculty Advisor" (faculty).' });
    }

    let normDept = normalizeDepartment(department);
    if (!normDept) {
      return res.status(400).json({ success: false, message: 'Department selection is required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid registered email address.' });
    }

    if (!/^[0-9]{10}$/.test(normPhone)) {
      return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits.' });
    }

    // Check duplicate Login ID across both Staff and Warden collections
    const [existingStaff, existingWarden] = await Promise.all([
      Staff.findOne({
        $or: [
          { username: normUsername },
          { staffId: new RegExp('^' + normUsername + '$', 'i') }
        ]
      }),
      Warden.findOne({
        $or: [
          { username: normUsername },
          { staffId: new RegExp('^' + normUsername + '$', 'i') }
        ]
      })
    ]);

    if (existingStaff || existingWarden) {
      return res.status(400).json({
        success: false,
        message: `Login ID "${username.trim()}" is already registered. Please choose a unique Login ID.`
      });
    }

    const displayYear = normalizeYearDisplay(normYear);

    if (normRole === 'faculty') {
      const designation = displayYear && displayYear !== 'All Years' ? `${displayYear} ${normDept} Faculty Advisor` : `${normDept} Faculty Advisor`;
      const newStaff = await Staff.create({
        name: normName,
        username: normUsername,
        staffId: normUsername,
        role: 'Faculty Advisor',
        department: normDept,
        assignedYear: normYear,
        year: normYear,
        email: normEmail,
        phone: normPhone,
        password: rawPassword,
        designation,
        status: 'active'
      });

      return res.status(201).json({
        success: true,
        message: 'New Faculty Advisor account added successfully to staff collection.',
        user: {
          id: newStaff._id,
          _id: newStaff._id,
          name: newStaff.name,
          username: newStaff.username,
          staffId: newStaff.staffId,
          role: 'faculty',
          department: newStaff.department,
          year: newStaff.assignedYear || newStaff.year,
          email: newStaff.email,
          phone: newStaff.phone,
          designation: newStaff.designation,
          status: newStaff.status
        }
      });
    } else {
      const designation = displayYear && displayYear !== 'All Years' ? `${displayYear} Warden` : 'Warden';
      const newWarden = await Warden.create({
        name: normName,
        username: normUsername,
        staffId: normUsername,
        role: 'Warden',
        department: normDept,
        assignedYear: normYear,
        year: normYear,
        email: normEmail,
        phone: normPhone,
        password: rawPassword,
        designation,
        status: 'active'
      });

      return res.status(201).json({
        success: true,
        message: 'New Warden account added successfully to wardens collection.',
        user: {
          id: newWarden._id,
          _id: newWarden._id,
          name: newWarden.name,
          username: newWarden.username,
          staffId: newWarden.staffId,
          role: 'staff',
          department: newWarden.department,
          year: newWarden.assignedYear || newWarden.year,
          email: newWarden.email,
          phone: newWarden.phone,
          designation: newWarden.designation,
          status: newWarden.status
        }
      });
    }
  } catch (error) {
    console.error('Add staff account error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating staff account.' });
  }
});

// @route   DELETE /api/users/staff/:id or DELETE /api/users/:id
// @desc    Admin endpoint to permanently delete a Warden or Faculty Advisor account
// @access  Private (Staff/Admin)
const deleteStaffHandler = async (req, res) => {
  try {
    const targetUserId = req.params.id;

    if (req.user._id && req.user._id.toString() === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Action prohibited: You cannot delete your own currently logged-in Admin account.'
      });
    }

    let deleted = await Staff.findByIdAndDelete(targetUserId);
    if (!deleted) {
      deleted = await Warden.findByIdAndDelete(targetUserId);
    }
    if (!deleted) {
      deleted = await User.findByIdAndDelete(targetUserId);
    }

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Staff account not found or already deleted.' });
    }

    return res.json({
      success: true,
      message: 'Staff account deleted successfully.'
    });
  } catch (error) {
    console.error('Delete staff account error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting staff account.' });
  }
};

router.delete('/staff/:id', protect, protectWardenAllowlist, deleteStaffHandler);
router.delete('/:id', protect, protectWardenAllowlist, deleteStaffHandler);

module.exports = router;
