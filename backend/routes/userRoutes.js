const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// @route   PUT /api/users/profile
// @desc    Update user profile details (e.g. homeAddress)
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { homeAddress } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (homeAddress !== undefined) {
      user.homeAddress = homeAddress.trim();
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
        homeAddress: user.homeAddress
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
});

module.exports = router;
