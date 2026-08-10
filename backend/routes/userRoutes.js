const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

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

// @route   GET /api/users/staff-list
// @desc    Get list of all faculty and staff users for Admin management
// @access  Private (Staff/Faculty/Admin)
router.get('/staff-list', protect, async (req, res) => {
  try {
    if (!['staff', 'faculty', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const users = await User.find({ role: { $in: ['faculty', 'staff', 'admin'] } })
      .select('-password')
      .sort({ name: 1 });

    return res.json({ success: true, users });
  } catch (error) {
    console.error('Get staff list error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching staff list' });
  }
});

// @route   PUT /api/users/:id/admin-update
// @desc    Admin endpoint to update faculty/staff member's department, year, role, or status
// @access  Private (Staff/Admin)
router.put('/:id/admin-update', protect, async (req, res) => {
  try {
    if (!['staff', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Admin or Warden access required.' });
    }

    const { department, year, role, status, designation } = req.body;
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Faculty/Staff user not found.' });
    }

    if (department !== undefined) targetUser.department = department.trim();
    if (year !== undefined) targetUser.year = year.trim();
    if (role !== undefined) targetUser.role = role.trim();
    if (status !== undefined) targetUser.status = status.trim();
    if (designation !== undefined) targetUser.designation = designation.trim();

    await targetUser.save();

    return res.json({
      success: true,
      message: `Updated permissions for ${targetUser.name || targetUser.username}`,
      user: {
        id: targetUser._id,
        username: targetUser.username,
        role: targetUser.role,
        name: targetUser.name,
        designation: targetUser.designation,
        department: targetUser.department,
        year: targetUser.year,
        status: targetUser.status
      }
    });
  } catch (error) {
    console.error('Admin update user error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating user permissions' });
  }
});

module.exports = router;
