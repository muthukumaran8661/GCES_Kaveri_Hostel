const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, WARDEN_ALLOWLIST_USERNAMES, FACULTY_ALLOWLIST_USERNAMES } = require('../middleware/authMiddleware');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'gces_kaveri_hostel_secret_key', {
    expiresIn: '30d'
  });
};

// @route   POST /api/auth/signup
// @desc    Register a new student user
// @access  Public
router.post('/signup', async (req, res) => {
  try {
    const { role, username, password, name, reg, room, studentId, staffId, designation, department, year, email, phone, homeAddress } = req.body;

    if (!role || !username || !password || !name) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
    }

    if (role === 'staff' || role === 'admin' || role === 'faculty') {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Self-registration of Warden and Faculty Advisor accounts is disabled. Only pre-authorized accounts can log in.'
      });
    }

    const normalizedUsername = username.trim().toLowerCase();

    // Check if user already exists
    const userExists = await User.findOne({ username: normalizedUsername });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: role === 'student'
          ? 'That Student ID is already registered — log in instead.'
          : 'That Warden/Admin/Faculty ID is already registered — log in instead.'
      });
    }

    let finalDepartment = (department || '').trim();

    // Additional validations & department enforcement
    if (role === 'student') {
      if (!/^8301[0-9]{8}$/.test(reg)) {
        return res.status(400).json({ success: false, message: 'Register No. must be 12 digits, starting with 8301.' });
      }
      if (!/^[0-9]+$/.test(room)) {
        return res.status(400).json({ success: false, message: 'Room No. must be numbers only.' });
      }
    } else if (role === 'staff' || role === 'admin') {
      if (phone && !/^[0-9]{10}$/.test(phone.trim())) {
        return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits.' });
      }
      if (finalDepartment && finalDepartment.toLowerCase() !== 'hostel administration') {
        return res.status(400).json({ success: false, message: 'Invalid department for Warden / Admin. Department must be "Hostel Administration".' });
      }
      finalDepartment = 'Hostel Administration';
    } else if (role === 'faculty') {
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Faculty Name is required.' });
      }
      if (phone && !/^[0-9]{10}$/.test(phone.trim())) {
        return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits.' });
      }
    }

    const user = await User.create({
      username: normalizedUsername,
      password,
      role: role || 'student',
      name,
      reg: reg || '',
      room: room || '',
      studentId: studentId || normalizedUsername,
      staffId: staffId || normalizedUsername,
      designation: designation || (role === 'faculty' ? 'Faculty Advisor' : 'Hostel Warden / Admin'),
      department: finalDepartment,
      year: year || '',
      status: 'active',
      email: email || '',
      phone: phone || '',
      homeAddress: homeAddress || ''
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      token,
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
        department: user.department,
        year: user.year,
        status: user.status,
        email: user.email,
        phone: user.phone,
        homeAddress: user.homeAddress
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ success: false, message: 'Server error during signup.' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { role, username, password } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ success: false, message: 'Please enter all credentials.' });
    }

    const normalizedUsername = username.trim().toLowerCase();

    if ((role === 'staff' || role === 'admin') && !WARDEN_ALLOWLIST_USERNAMES.includes(normalizedUsername)) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Access Denied. Your Warden ID is not an authorized account.'
      });
    }

    if (role === 'faculty' && !FACULTY_ALLOWLIST_USERNAMES.includes(normalizedUsername)) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Access Denied. Your Faculty ID is not an authorized Faculty Advisor account.'
      });
    }

    if (role === 'student' && !/^8301[0-9]{8}$/.test(password)) {
      return res.status(400).json({ success: false, message: 'Register No. must be 12 digits, starting with 8301.' });
    }

    const user = await User.findOne({ username: normalizedUsername, role });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: role === 'student'
          ? 'No match. Check your Student ID, and remember the password is your Register No.'
          : 'No matching account. Check your details or create an account.'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: role === 'student'
          ? 'No match. Check your Student ID, and remember the password is your Register No.'
          : 'Invalid credentials.'
      });
    }

    const token = generateToken(user._id);

    return res.json({
      success: true,
      token,
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
        department: user.department,
        year: user.year,
        status: user.status,
        email: user.email,
        phone: user.phone,
        homeAddress: user.homeAddress
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current logged in user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  return res.json({
    success: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      role: req.user.role,
      name: req.user.name,
      reg: req.user.reg,
      room: req.user.room,
      studentId: req.user.studentId,
      staffId: req.user.staffId,
      designation: req.user.designation,
      department: req.user.department,
      year: req.user.year,
      status: req.user.status,
      email: req.user.email,
      phone: req.user.phone,
      homeAddress: req.user.homeAddress
    }
  });
});

module.exports = router;
