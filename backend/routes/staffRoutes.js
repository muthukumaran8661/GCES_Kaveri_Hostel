const express = require('express');
const router = express.Router();
const Staff = require('../models/Staff');
const { protect, protectFaculty, protectWardenAllowlist, protectStaffOrFaculty } = require('../middleware/authMiddleware');
const { normalizeDepartment, normalizeYear } = require('../utils/normalization');

function normalizeYearDisplay(y) {
  if (!y) return 'All Years';
  const s = String(y).trim();
  if (/^I(\s+Year)?$/i.test(s) || /^1(st)?(\s+Year)?$/i.test(s)) return 'I Year';
  if (/^II(\s+Year)?$/i.test(s) || /^2(nd)?(\s+Year)?$/i.test(s)) return 'II Year';
  if (/^III(\s+Year)?$/i.test(s) || /^3(rd)?(\s+Year)?$/i.test(s)) return 'III Year';
  if (/^IV(\s+Year)?$/i.test(s) || /^4(th)?(\s+Year)?$/i.test(s)) return 'IV Year';
  return s;
}

// @route   GET /api/staff/profile
// @desc    Get logged in Faculty Advisor profile
// @access  Private (Faculty Advisor)
router.get('/profile', protect, protectFaculty, async (req, res) => {
  try {
    const staff = await Staff.findById(req.user._id).select('-password');
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Faculty Advisor account not found in staff collection.' });
    }
    return res.json({ success: true, staff });
  } catch (error) {
    console.error('Get staff profile error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching profile.' });
  }
});

// @route   GET /api/staff
// @desc    List all Faculty Advisors from staff collection
// @access  Private (Staff/Faculty/Admin)
router.get('/', protect, protectStaffOrFaculty, async (req, res) => {
  try {
    const list = await Staff.find().select('-password').sort({ department: 1, assignedYear: 1 });
    return res.json({ success: true, staff: list });
  } catch (error) {
    console.error('List staff error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching staff list.' });
  }
});

// @route   POST /api/staff
// @desc    Admin add Faculty Advisor account to staff collection
// @access  Private (Warden/Admin)
router.post('/', protect, protectWardenAllowlist, async (req, res) => {
  try {
    const { name, username, staffId, department, assignedYear, year, email, phone, password } = req.body;

    if (!name || !username || !department || !password) {
      return res.status(400).json({ success: false, message: 'Name, Login ID, Department, and Password are required.' });
    }

    const normUsername = username.trim().toLowerCase();
    const normDept = normalizeDepartment(department);
    const normYear = normalizeYear(assignedYear || year || 'I Year');

    const exists = await Staff.findOne({
      $or: [
        { username: normUsername },
        { staffId: new RegExp('^' + normUsername + '$', 'i') }
      ]
    });

    if (exists) {
      return res.status(400).json({ success: false, message: 'Faculty Advisor with this Login ID already exists.' });
    }

    const displayYear = normalizeYearDisplay(normYear);
    const designation = `${displayYear} ${normDept} Faculty Advisor`;

    const newStaff = await Staff.create({
      name: name.trim(),
      username: normUsername,
      staffId: staffId ? staffId.trim() : normUsername,
      department: normDept,
      assignedYear: normYear,
      year: normYear,
      email: (email || '').trim().toLowerCase(),
      phone: (phone || '').trim(),
      password: password.trim(),
      designation,
      role: 'Faculty Advisor',
      status: 'active'
    });

    return res.status(201).json({
      success: true,
      message: 'Faculty Advisor added successfully to staff collection.',
      staff: newStaff
    });
  } catch (error) {
    console.error('Create staff error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating Faculty Advisor.' });
  }
});

// @route   PUT /api/staff/:id
// @desc    Admin edit Faculty Advisor account
// @access  Private (Warden/Admin)
router.put('/:id', protect, protectWardenAllowlist, async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Faculty Advisor not found.' });
    }

    const { name, department, assignedYear, year, email, phone, status, designation, password } = req.body;

    if (name !== undefined) staff.name = name.trim();
    if (department !== undefined) staff.department = normalizeDepartment(department);
    if (assignedYear !== undefined || year !== undefined) {
      const normY = normalizeYear(assignedYear || year);
      staff.assignedYear = normY;
      staff.year = normY;
    }
    if (email !== undefined) staff.email = email.trim().toLowerCase();
    if (phone !== undefined) staff.phone = phone.trim();
    if (status !== undefined) staff.status = status.trim();
    if (designation !== undefined) {
      staff.designation = designation.trim();
    } else if (department || assignedYear || year) {
      const displayY = normalizeYearDisplay(staff.assignedYear || staff.year);
      staff.designation = `${displayY} ${staff.department} Faculty Advisor`;
    }
    if (password && password.trim()) staff.password = password.trim();

    await staff.save();

    return res.json({
      success: true,
      message: 'Faculty Advisor updated successfully.',
      staff
    });
  } catch (error) {
    console.error('Update staff error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating Faculty Advisor.' });
  }
});

// @route   DELETE /api/staff/:id
// @desc    Admin delete Faculty Advisor account
// @access  Private (Warden/Admin)
router.delete('/:id', protect, protectWardenAllowlist, async (req, res) => {
  try {
    const deleted = await Staff.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Faculty Advisor not found or already deleted.' });
    }
    return res.json({ success: true, message: 'Faculty Advisor deleted successfully from staff collection.' });
  } catch (error) {
    console.error('Delete staff error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting Faculty Advisor.' });
  }
});

module.exports = router;
