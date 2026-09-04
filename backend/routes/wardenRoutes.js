const express = require('express');
const router = express.Router();
const Warden = require('../models/Warden');
const { protect, protectWarden, protectWardenAllowlist } = require('../middleware/authMiddleware');
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

// @route   GET /api/wardens/profile
// @desc    Get logged in Warden profile
// @access  Private (Warden)
router.get('/profile', protect, protectWarden, async (req, res) => {
  try {
    const warden = await Warden.findById(req.user._id).select('-password');
    if (!warden) {
      return res.status(404).json({ success: false, message: 'Warden account not found in wardens collection.' });
    }
    return res.json({ success: true, warden });
  } catch (error) {
    console.error('Get warden profile error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching profile.' });
  }
});

// @route   GET /api/wardens
// @desc    List all Wardens from wardens collection
// @access  Private (Warden/Admin)
router.get('/', protect, protectWardenAllowlist, async (req, res) => {
  try {
    const list = await Warden.find().select('-password').sort({ assignedYear: 1, name: 1 });
    return res.json({ success: true, wardens: list });
  } catch (error) {
    console.error('List wardens error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching wardens.' });
  }
});

// @route   POST /api/wardens
// @desc    Admin add Warden account to wardens collection
// @access  Private (Warden/Admin)
router.post('/', protect, protectWardenAllowlist, async (req, res) => {
  try {
    const { name, username, staffId, department, assignedYear, year, email, phone, password, role } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ success: false, message: 'Name, Login ID, and Password are required.' });
    }

    const normUsername = username.trim().toLowerCase();
    const normDept = department ? normalizeDepartment(department) : 'Hostel Administration';
    const normYear = normalizeYear(assignedYear || year || 'All Years');

    const exists = await Warden.findOne({
      $or: [
        { username: normUsername },
        { staffId: new RegExp('^' + normUsername + '$', 'i') }
      ]
    });

    if (exists) {
      return res.status(400).json({ success: false, message: 'Warden with this Login ID already exists.' });
    }

    const displayYear = normalizeYearDisplay(normYear);
    const designation = displayYear && displayYear !== 'All Years' ? `${displayYear} Warden` : 'Warden';

    const newWarden = await Warden.create({
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
      role: role && role.toLowerCase() === 'admin' ? 'admin' : 'Warden',
      status: 'active'
    });

    return res.status(201).json({
      success: true,
      message: 'Warden added successfully to wardens collection.',
      warden: newWarden
    });
  } catch (error) {
    console.error('Create warden error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating Warden.' });
  }
});

// @route   PUT /api/wardens/:id
// @desc    Admin edit Warden account
// @access  Private (Warden/Admin)
router.put('/:id', protect, protectWardenAllowlist, async (req, res) => {
  try {
    const warden = await Warden.findById(req.params.id);
    if (!warden) {
      return res.status(404).json({ success: false, message: 'Warden not found.' });
    }

    const { name, department, assignedYear, year, email, phone, status, designation, password, role } = req.body;

    if (name !== undefined) warden.name = name.trim();
    if (department !== undefined) warden.department = normalizeDepartment(department);
    if (assignedYear !== undefined || year !== undefined) {
      const normY = normalizeYear(assignedYear || year);
      warden.assignedYear = normY;
      warden.year = normY;
    }
    if (email !== undefined) warden.email = email.trim().toLowerCase();
    if (phone !== undefined) warden.phone = phone.trim();
    if (status !== undefined) warden.status = status.trim();
    if (role !== undefined) warden.role = role.trim();
    if (designation !== undefined) {
      warden.designation = designation.trim();
    } else if (assignedYear || year) {
      const displayY = normalizeYearDisplay(warden.assignedYear || warden.year);
      warden.designation = displayY && displayY !== 'All Years' ? `${displayY} Warden` : 'Warden';
    }
    if (password && password.trim()) warden.password = password.trim();

    await warden.save();

    return res.json({
      success: true,
      message: 'Warden updated successfully.',
      warden
    });
  } catch (error) {
    console.error('Update warden error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating Warden.' });
  }
});

// @route   DELETE /api/wardens/:id
// @desc    Admin delete Warden account
// @access  Private (Warden/Admin)
router.delete('/:id', protect, protectWardenAllowlist, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (req.user._id && req.user._id.toString() === targetId) {
      return res.status(400).json({ success: false, message: 'Cannot delete currently logged-in account.' });
    }

    const deleted = await Warden.findByIdAndDelete(targetId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Warden not found or already deleted.' });
    }
    return res.json({ success: true, message: 'Warden deleted successfully from wardens collection.' });
  } catch (error) {
    console.error('Delete warden error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting Warden.' });
  }
});

module.exports = router;
