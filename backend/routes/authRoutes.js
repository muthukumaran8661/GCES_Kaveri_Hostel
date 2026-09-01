const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, WARDEN_ALLOWLIST_USERNAMES, FACULTY_ALLOWLIST_USERNAMES } = require('../middleware/authMiddleware');
const { sendEmail } = require('../utils/mailer');


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

    if (role === 'student' && !/^8301[0-9]{8}$/.test(password)) {
      return res.status(400).json({ success: false, message: 'Register No. must be 12 digits, starting with 8301.' });
    }

    const user = await User.findOne({ username: normalizedUsername, role });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: role === 'student'
          ? 'No match. Check your Student ID, and remember the password is your Register No.'
          : 'No matching account. Check your details or contact Admin.'
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Your account is currently set to Inactive. Please contact the Hostel Admin.'
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

// @route   POST /api/auth/warden/forgot-password
// @desc    Initiate password reset for Warden account via exact Warden ID + Email
// @access  Public
router.post('/warden/forgot-password', async (req, res) => {
  try {
    const { staffId, wardenId, username, email } = req.body;
    const inputWardenId = (staffId || wardenId || username || '').trim();
    const inputEmail = (email || '').trim().toLowerCase();

    if (!inputWardenId) {
      return res.status(400).json({ success: false, message: 'Please enter your Warden ID.' });
    }

    if (!inputEmail) {
      return res.status(400).json({ success: false, message: 'Please enter your registered email address.' });
    }

    const cleanWardenId = inputWardenId.toLowerCase();

    // 1. Verify Warden ID exists in active Warden accounts
    const wardenUser = await User.findOne({
      $or: [
        { username: cleanWardenId },
        { staffId: new RegExp('^' + cleanWardenId + '$', 'i') }
      ],
      role: { $in: ['staff', 'admin'] }
    });

    if (!wardenUser) {
      return res.status(404).json({
        success: false,
        message: 'Invalid Warden ID.'
      });
    }

    // 2. Verify registered Email matches this exact Warden ID
    const registeredEmail = (wardenUser.email || '').trim().toLowerCase();
    if (!registeredEmail || registeredEmail !== inputEmail) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registered email for this Warden ID.'
      });
    }

    // 3. Generate secure 6-digit OTP (expires in 5 minutes)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. Send Email to the exact registered email address FIRST
    const mailResult = await sendEmail({
      to: wardenUser.email,
      subject: 'GCES Kaveri Hostel - Warden Password Reset OTP',
      text: `Hello ${wardenUser.name || 'Warden'},\n\nYour OTP for password reset (Warden ID: ${wardenUser.staffId || wardenUser.username}) is: ${otp}\nThis OTP is valid for 5 minutes.\nIf you did not request a password reset, please ignore this message.\n\nRegards,\nGCES Kaveri Hostel Administration`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #2A2140; max-width: 500px; margin: 0 auto; border: 1px solid #EAD9BE; border-radius: 12px; background-color: #FBF6EC;">
          <h2 style="color: #9E1B32; margin-top: 0;">GCES Kaveri Hostel Admin</h2>
          <p style="font-size: 14px;">Hello <strong>${wardenUser.name || 'Warden'}</strong> (${wardenUser.staffId || wardenUser.username}),</p>
          <p style="font-size: 14px;">Your OTP for resetting your Warden account password is:</p>
          <div style="font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #127A6E; padding: 12px 20px; background: #EAF6F4; display: inline-block; border-radius: 8px; margin: 12px 0; border: 1px solid #127A6E;">${otp}</div>
          <p style="font-size: 13px; color: #7A7290;">This OTP will expire in 5 minutes.</p>
          <hr style="border: none; border-top: 1px solid #EAD9BE; margin: 20px 0;" />
          <p style="font-size: 11px; color: #7A7290;">If you did not request a password reset, please ignore this message.</p>
        </div>
      `
    });

    if (!mailResult.success) {
      return res.status(500).json({
        success: false,
        message: mailResult.error || 'Unable to send OTP. Please try again later.'
      });
    }

    // Save OTP to DB ONLY after real email dispatch succeeds
    wardenUser.resetOtp = otp;
    wardenUser.resetOtpExpire = new Date(Date.now() + 5 * 60 * 1000); // 5 mins expiry
    await wardenUser.save();

    return res.json({
      success: true,
      message: 'OTP has been sent to your registered email address.'
    });
  } catch (error) {
    console.error('Warden forgot-password error:', error);
    return res.status(500).json({ success: false, message: 'Server error processing password reset request.' });
  }
});

// @route   POST /api/auth/warden/verify-otp
// @desc    Verify OTP for Warden password reset
// @access  Public
router.post('/warden/verify-otp', async (req, res) => {
  try {
    const { staffId, wardenId, username, email, otp } = req.body;
    const inputWardenId = (staffId || wardenId || username || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();

    if (!inputWardenId || !cleanEmail || !cleanOtp) {
      return res.status(400).json({ success: false, message: 'Warden ID, Email, and OTP are required.' });
    }

    const cleanWardenId = inputWardenId.toLowerCase();

    const wardenUser = await User.findOne({
      $or: [
        { username: cleanWardenId },
        { staffId: new RegExp('^' + cleanWardenId + '$', 'i') }
      ],
      email: cleanEmail,
      role: { $in: ['staff', 'admin'] }
    });

    if (!wardenUser) {
      return res.status(404).json({ success: false, message: 'Invalid Warden ID or Email.' });
    }

    if (!wardenUser.resetOtp || wardenUser.resetOtp !== cleanOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code. Please check and try again.' });
    }

    if (!wardenUser.resetOtpExpire || wardenUser.resetOtpExpire < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new OTP.' });
    }

    return res.json({
      success: true,
      message: 'OTP verified successfully.'
    });
  } catch (error) {
    console.error('Warden verify-otp error:', error);
    return res.status(500).json({ success: false, message: 'Server error verifying OTP.' });
  }
});

// @route   POST /api/auth/warden/reset-password
// @desc    Set new password after OTP verification for specific Warden ID
// @access  Public
router.post('/warden/reset-password', async (req, res) => {
  try {
    const { staffId, wardenId, username, email, otp, newPassword } = req.body;
    const inputWardenId = (staffId || wardenId || username || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();

    if (!inputWardenId || !cleanEmail || !cleanOtp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Warden ID, Email, OTP, and new password are required.' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters long.' });
    }

    const cleanWardenId = inputWardenId.toLowerCase();

    const wardenUser = await User.findOne({
      $or: [
        { username: cleanWardenId },
        { staffId: new RegExp('^' + cleanWardenId + '$', 'i') }
      ],
      email: cleanEmail,
      role: { $in: ['staff', 'admin'] }
    });

    if (!wardenUser) {
      return res.status(404).json({ success: false, message: 'Warden account not found.' });
    }

    if (!wardenUser.resetOtp || wardenUser.resetOtp !== cleanOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code. Password reset aborted.' });
    }

    if (!wardenUser.resetOtpExpire || wardenUser.resetOtpExpire < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new password reset.' });
    }

    // Update password for ONLY this Warden account (pre-save hook hashes password using bcrypt)
    wardenUser.password = newPassword;
    wardenUser.resetOtp = '';
    wardenUser.resetOtpExpire = null;

    await wardenUser.save();

    return res.json({
      success: true,
      message: 'Password updated successfully! You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Warden reset-password error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating password.' });
  }
});

// =====================================================================
// FACULTY ADVISOR PASSWORD RESET ROUTES
// =====================================================================

// @route   POST /api/auth/faculty/forgot-password
// @desc    Initiate password reset for Faculty Advisor account via exact Faculty ID + Email
// @access  Public
router.post('/faculty/forgot-password', async (req, res) => {
  try {
    const { staffId, facultyId, username, email } = req.body;
    const inputFacultyId = (staffId || facultyId || username || '').trim();
    const inputEmail = (email || '').trim().toLowerCase();

    if (!inputFacultyId) {
      return res.status(400).json({ success: false, message: 'Please enter your Faculty Advisor ID.' });
    }

    if (!inputEmail) {
      return res.status(400).json({ success: false, message: 'Please enter your registered email address.' });
    }

    const cleanFacultyId = inputFacultyId.toLowerCase();

    // 1. Verify Faculty Advisor ID exists in active Faculty accounts
    const facultyUser = await User.findOne({
      $or: [
        { username: cleanFacultyId },
        { staffId: new RegExp('^' + cleanFacultyId + '$', 'i') }
      ],
      role: 'faculty'
    });

    if (!facultyUser) {
      return res.status(404).json({
        success: false,
        message: 'Invalid Faculty Advisor ID.'
      });
    }

    // 2. Verify registered Email matches this exact Faculty Advisor ID
    const registeredEmail = (facultyUser.email || '').trim().toLowerCase();
    if (!registeredEmail || registeredEmail !== inputEmail) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registered email for this Faculty Advisor ID.'
      });
    }

    // 3. Generate secure 6-digit OTP (expires in 5 minutes)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. Send Email to the exact registered email address FIRST
    const mailResult = await sendEmail({
      to: facultyUser.email,
      subject: 'GCES Kaveri Hostel - Faculty Advisor Password Reset OTP',
      text: `Hello ${facultyUser.name || 'Faculty Advisor'},\n\nYour OTP for password reset (Faculty Advisor ID: ${facultyUser.staffId || facultyUser.username}) is: ${otp}\nThis OTP is valid for 5 minutes.\nIf you did not request a password reset, please ignore this message.\n\nRegards,\nGCES Kaveri Hostel Administration`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #2A2140; max-width: 500px; margin: 0 auto; border: 1px solid #EAD9BE; border-radius: 12px; background-color: #FBF6EC;">
          <h2 style="color: #9E1B32; margin-top: 0;">GCES Kaveri Hostel Admin</h2>
          <p style="font-size: 14px;">Hello <strong>${facultyUser.name || 'Faculty Advisor'}</strong> (${facultyUser.staffId || facultyUser.username}),</p>
          <p style="font-size: 14px;">Your OTP for resetting your Faculty Advisor account password is:</p>
          <div style="font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #127A6E; padding: 12px 20px; background: #EAF6F4; display: inline-block; border-radius: 8px; margin: 12px 0; border: 1px solid #127A6E;">${otp}</div>
          <p style="font-size: 13px; color: #7A7290;">This OTP will expire in 5 minutes.</p>
          <hr style="border: none; border-top: 1px solid #EAD9BE; margin: 20px 0;" />
          <p style="font-size: 11px; color: #7A7290;">If you did not request a password reset, please ignore this message.</p>
        </div>
      `
    });

    if (!mailResult.success) {
      return res.status(500).json({
        success: false,
        message: mailResult.error || 'Unable to send OTP. Please try again later.'
      });
    }

    // Save OTP to DB ONLY after real email dispatch succeeds
    facultyUser.resetOtp = otp;
    facultyUser.resetOtpExpire = new Date(Date.now() + 5 * 60 * 1000); // 5 mins expiry
    await facultyUser.save();

    return res.json({
      success: true,
      message: 'OTP has been sent to your registered email address.'
    });
  } catch (error) {
    console.error('Faculty forgot-password error:', error);
    return res.status(500).json({ success: false, message: 'Server error processing password reset request.' });
  }
});

// @route   POST /api/auth/faculty/verify-otp
// @desc    Verify OTP for Faculty Advisor password reset
// @access  Public
router.post('/faculty/verify-otp', async (req, res) => {
  try {
    const { staffId, facultyId, username, email, otp } = req.body;
    const inputFacultyId = (staffId || facultyId || username || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();

    if (!inputFacultyId || !cleanEmail || !cleanOtp) {
      return res.status(400).json({ success: false, message: 'Faculty Advisor ID, Email, and OTP are required.' });
    }

    const cleanFacultyId = inputFacultyId.toLowerCase();

    const facultyUser = await User.findOne({
      $or: [
        { username: cleanFacultyId },
        { staffId: new RegExp('^' + cleanFacultyId + '$', 'i') }
      ],
      email: cleanEmail,
      role: 'faculty'
    });

    if (!facultyUser) {
      return res.status(404).json({ success: false, message: 'Invalid Faculty Advisor ID or Email.' });
    }

    if (!facultyUser.resetOtp || facultyUser.resetOtp !== cleanOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code. Please check and try again.' });
    }

    if (!facultyUser.resetOtpExpire || facultyUser.resetOtpExpire < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new OTP.' });
    }

    return res.json({
      success: true,
      message: 'OTP verified successfully.'
    });
  } catch (error) {
    console.error('Faculty verify-otp error:', error);
    return res.status(500).json({ success: false, message: 'Server error verifying OTP.' });
  }
});

// @route   POST /api/auth/faculty/reset-password
// @desc    Set new password after OTP verification for specific Faculty Advisor ID
// @access  Public
router.post('/api/auth/faculty/reset-password', async (req, res) => {
  try {
    const { staffId, facultyId, username, email, otp, newPassword } = req.body;
    const inputFacultyId = (staffId || facultyId || username || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();

    if (!inputFacultyId || !cleanEmail || !cleanOtp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Faculty Advisor ID, Email, OTP, and new password are required.' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters long.' });
    }

    const cleanFacultyId = inputFacultyId.toLowerCase();

    const facultyUser = await User.findOne({
      $or: [
        { username: cleanFacultyId },
        { staffId: new RegExp('^' + cleanFacultyId + '$', 'i') }
      ],
      email: cleanEmail,
      role: 'faculty'
    });

    if (!facultyUser) {
      return res.status(404).json({ success: false, message: 'Faculty Advisor account not found.' });
    }

    if (!facultyUser.resetOtp || facultyUser.resetOtp !== cleanOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code. Password reset aborted.' });
    }

    if (!facultyUser.resetOtpExpire || facultyUser.resetOtpExpire < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new password reset.' });
    }

    // Update password for ONLY this Faculty Advisor account (pre-save hook hashes password using bcrypt)
    facultyUser.password = newPassword;
    facultyUser.resetOtp = '';
    facultyUser.resetOtpExpire = null;

    await facultyUser.save();

    return res.json({
      success: true,
      message: 'Password reset successfully.'
    });
  } catch (error) {
    console.error('Faculty reset-password error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating password.' });
  }
});

// Also register route without prefix for safety
router.post('/faculty/reset-password', async (req, res) => {
  try {
    const { staffId, facultyId, username, email, otp, newPassword } = req.body;
    const inputFacultyId = (staffId || facultyId || username || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();

    if (!inputFacultyId || !cleanEmail || !cleanOtp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Faculty Advisor ID, Email, OTP, and new password are required.' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters long.' });
    }

    const cleanFacultyId = inputFacultyId.toLowerCase();

    const facultyUser = await User.findOne({
      $or: [
        { username: cleanFacultyId },
        { staffId: new RegExp('^' + cleanFacultyId + '$', 'i') }
      ],
      email: cleanEmail,
      role: 'faculty'
    });

    if (!facultyUser) {
      return res.status(404).json({ success: false, message: 'Faculty Advisor account not found.' });
    }

    if (!facultyUser.resetOtp || facultyUser.resetOtp !== cleanOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code. Password reset aborted.' });
    }

    if (!facultyUser.resetOtpExpire || facultyUser.resetOtpExpire < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new password reset.' });
    }

    facultyUser.password = newPassword;
    facultyUser.resetOtp = '';
    facultyUser.resetOtpExpire = null;

    await facultyUser.save();

    return res.json({
      success: true,
      message: 'Password reset successfully.'
    });
  } catch (error) {
    console.error('Faculty reset-password error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating password.' });
  }
});

// =====================================================================
// STUDENT PASSWORD RESET ROUTES
// =====================================================================

// @route   POST /api/auth/student/forgot-password
// @desc    Initiate password reset for Student account via Student ID + Email
// @access  Public
router.post('/student/forgot-password', async (req, res) => {
  try {
    const { studentId, username, email } = req.body;
    const inputStudentId = (studentId || username || '').trim();
    const inputEmail = (email || '').trim().toLowerCase();

    if (!inputStudentId) {
      return res.status(400).json({ success: false, message: 'Please enter your Student ID.' });
    }
    if (!inputEmail) {
      return res.status(400).json({ success: false, message: 'Please enter your registered email address.' });
    }

    const cleanStudentId = inputStudentId.toLowerCase();

    // 1. Find student by username or studentId field
    const studentUser = await User.findOne({
      $or: [
        { username: cleanStudentId },
        { studentId: new RegExp('^' + cleanStudentId + '$', 'i') }
      ],
      role: 'student'
    });

    if (!studentUser) {
      return res.status(404).json({
        success: false,
        message: 'No student account found with that Student ID.'
      });
    }

    // 2. Verify email matches registered email
    const registeredEmail = (studentUser.email || '').trim().toLowerCase();
    if (!registeredEmail || registeredEmail !== inputEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email does not match the registered email for this Student ID.'
      });
    }

    // 3. Generate secure 6-digit OTP (expires in 5 minutes)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. Send email FIRST, only save OTP if dispatch succeeds
    const mailResult = await sendEmail({
      to: studentUser.email,
      subject: 'GCES Kaveri Hostel - Student Password Reset OTP',
      text: `Hello ${studentUser.name || 'Student'},\n\nYour OTP for password reset (Student ID: ${studentUser.studentId || studentUser.username}) is: ${otp}\nThis OTP is valid for 5 minutes.\nIf you did not request a password reset, please ignore this message.\n\nRegards,\nGCES Kaveri Hostel Administration`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #2A2140; max-width: 500px; margin: 0 auto; border: 1px solid #EAD9BE; border-radius: 12px; background-color: #FBF6EC;">
          <h2 style="color: #9E1B32; margin-top: 0;">GCES Kaveri Hostel</h2>
          <p style="font-size: 14px;">Hello <strong>${studentUser.name || 'Student'}</strong> (${studentUser.studentId || studentUser.username}),</p>
          <p style="font-size: 14px;">Your OTP for resetting your student account password is:</p>
          <div style="font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #127A6E; padding: 12px 20px; background: #EAF6F4; display: inline-block; border-radius: 8px; margin: 12px 0; border: 1px solid #127A6E;">${otp}</div>
          <p style="font-size: 13px; color: #7A7290;">This OTP will expire in 5 minutes.</p>
          <hr style="border: none; border-top: 1px solid #EAD9BE; margin: 20px 0;" />
          <p style="font-size: 11px; color: #7A7290;">If you did not request a password reset, please ignore this message.</p>
        </div>
      `
    });

    if (!mailResult.success) {
      return res.status(500).json({
        success: false,
        message: mailResult.error || 'Unable to send OTP. Please try again later.'
      });
    }

    // Save OTP to DB ONLY after successful email dispatch
    studentUser.resetOtp = otp;
    studentUser.resetOtpExpire = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
    await studentUser.save();

    return res.json({
      success: true,
      message: 'OTP has been sent to your registered email address.'
    });
  } catch (error) {
    console.error('Student forgot-password error:', error);
    return res.status(500).json({ success: false, message: 'Server error processing password reset request.' });
  }
});

// @route   POST /api/auth/student/verify-otp
// @desc    Verify OTP for Student password reset
// @access  Public
router.post('/student/verify-otp', async (req, res) => {
  try {
    const { studentId, username, email, otp } = req.body;
    const inputStudentId = (studentId || username || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();

    if (!inputStudentId || !cleanEmail || !cleanOtp) {
      return res.status(400).json({ success: false, message: 'Student ID, Email, and OTP are required.' });
    }

    const cleanStudentId = inputStudentId.toLowerCase();

    const studentUser = await User.findOne({
      $or: [
        { username: cleanStudentId },
        { studentId: new RegExp('^' + cleanStudentId + '$', 'i') }
      ],
      email: cleanEmail,
      role: 'student'
    });

    if (!studentUser) {
      return res.status(404).json({ success: false, message: 'Invalid Student ID or Email.' });
    }

    if (!studentUser.resetOtp || studentUser.resetOtp !== cleanOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code. Please check and try again.' });
    }

    if (!studentUser.resetOtpExpire || studentUser.resetOtpExpire < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new OTP.' });
    }

    return res.json({
      success: true,
      message: 'OTP verified successfully.'
    });
  } catch (error) {
    console.error('Student verify-otp error:', error);
    return res.status(500).json({ success: false, message: 'Server error verifying OTP.' });
  }
});

// @route   POST /api/auth/student/reset-password
// @desc    Set new password after OTP verification for Student
// @access  Public
router.post('/student/reset-password', async (req, res) => {
  try {
    const { studentId, username, email, otp, newPassword } = req.body;
    const inputStudentId = (studentId || username || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();

    if (!inputStudentId || !cleanEmail || !cleanOtp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Student ID, Email, OTP, and new password are required.' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters long.' });
    }

    const cleanStudentId = inputStudentId.toLowerCase();

    const studentUser = await User.findOne({
      $or: [
        { username: cleanStudentId },
        { studentId: new RegExp('^' + cleanStudentId + '$', 'i') }
      ],
      email: cleanEmail,
      role: 'student'
    });

    if (!studentUser) {
      return res.status(404).json({ success: false, message: 'Student account not found.' });
    }

    if (!studentUser.resetOtp || studentUser.resetOtp !== cleanOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code. Password reset aborted.' });
    }

    if (!studentUser.resetOtpExpire || studentUser.resetOtpExpire < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new password reset.' });
    }

    // Update password (pre-save hook hashes it via bcrypt)
    studentUser.password = newPassword;
    studentUser.resetOtp = '';
    studentUser.resetOtpExpire = null;

    await studentUser.save();

    return res.json({
      success: true,
      message: 'Password updated successfully! You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Student reset-password error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating password.' });
  }
});

module.exports = router;


