const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const { protect, protectWardenAllowlist } = require('../middleware/authMiddleware');
const { normalizeDepartment, normalizeYear } = require('../utils/normalization');

// @route   GET /api/students/profile
// @desc    Get currently logged in student profile
// @access  Private (Student)
router.get('/profile', protect, async (req, res) => {
  try {
    const student = await Student.findById(req.user._id).select('-password');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student account not found.' });
    }
    return res.json({ success: true, student });
  } catch (error) {
    console.error('Get student profile error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching student profile.' });
  }
});

// @route   GET /api/students
// @desc    List all students for Admin Control
// @access  Private (Warden/Admin)
router.get('/', protect, protectWardenAllowlist, async (req, res) => {
  try {
    const students = await Student.find().select('-password').sort({ createdAt: -1 });
    return res.json({ success: true, students });
  } catch (error) {
    console.error('List students error:', error);
    return res.status(500).json({ success: false, message: 'Server error listing students.' });
  }
});

// @route   POST /api/students
// @desc    Admin add student account
// @access  Private (Warden/Admin)
router.post('/', protect, protectWardenAllowlist, async (req, res) => {
  try {
    const { name, username, reg, registerNumber, room, department, year, email, phone, password, homeAddress } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ success: false, message: 'Name, Login ID, and Password are required.' });
    }

    const normUsername = username.trim().toLowerCase();
    const finalReg = (reg || registerNumber || '').trim();

    const exists = await Student.findOne({
      $or: [
        { username: normUsername },
        { studentId: new RegExp('^' + normUsername + '$', 'i') },
        ...(finalReg ? [{ reg: finalReg }, { registerNumber: finalReg }] : [])
      ]
    });

    if (exists) {
      return res.status(400).json({ success: false, message: 'Student with this Login ID or Register No already exists.' });
    }

    // Email validation
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ success: false, message: 'Email ID is required.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    // Phone validation
    const rawPhone = (phone || '').trim();
    if (!rawPhone) {
      return res.status(400).json({ success: false, message: 'Phone Number is required.' });
    }
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    if (!/^[0-9]{10}$/.test(cleanPhone)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid phone number.' });
    }

    const emailExists = await Student.findOne({ email: cleanEmail });
    if (emailExists) {
      return res.status(400).json({ success: false, message: 'This email ID is already registered.' });
    }

    const newStudent = await Student.create({
      name: name.trim(),
      username: normUsername,
      registerNumber: finalReg,
      reg: finalReg,
      studentId: normUsername,
      password: password.trim(),
      room: (room || '').trim(),
      department: normalizeDepartment(department || ''),
      year: normalizeYear(year || ''),
      email: cleanEmail,
      phone: cleanPhone,
      homeAddress: (homeAddress || '').trim(),
      role: 'student',
      status: 'active'
    });

    return res.status(201).json({
      success: true,
      message: 'Student account created successfully in students collection.',
      student: {
        id: newStudent._id,
        _id: newStudent._id,
        name: newStudent.name,
        username: newStudent.username,
        reg: newStudent.reg,
        department: newStudent.department,
        year: newStudent.year,
        room: newStudent.room,
        email: newStudent.email,
        phone: newStudent.phone,
        status: newStudent.status
      }
    });
  } catch (error) {
    console.error('Create student error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating student account.' });
  }
});

// @route   PUT /api/students/:id
// @desc    Admin edit student account
// @access  Private (Warden/Admin)
router.put('/:id', protect, protectWardenAllowlist, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const { name, room, department, year, email, phone, status, homeAddress, password } = req.body;

    if (name !== undefined) student.name = name.trim();
    if (room !== undefined) student.room = room.trim();
    if (department !== undefined) student.department = normalizeDepartment(department);
    if (year !== undefined) student.year = normalizeYear(year);
    if (email !== undefined) student.email = email.trim().toLowerCase();
    if (phone !== undefined) student.phone = phone.trim();
    if (status !== undefined) student.status = status.trim();
    if (homeAddress !== undefined) student.homeAddress = homeAddress.trim();
    if (password && password.trim()) student.password = password.trim();

    await student.save();

    return res.json({
      success: true,
      message: 'Student updated successfully.',
      student: {
        id: student._id,
        _id: student._id,
        name: student.name,
        username: student.username,
        reg: student.reg,
        department: student.department,
        year: student.year,
        room: student.room,
        email: student.email,
        phone: student.phone,
        status: student.status
      }
    });
  } catch (error) {
    console.error('Update student error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating student account.' });
  }
});

// @route   DELETE /api/students/:id
// @desc    Admin delete student account
// @access  Private (Warden/Admin)
router.delete('/:id', protect, protectWardenAllowlist, async (req, res) => {
  try {
    const deleted = await Student.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Student not found or already deleted.' });
    }
    return res.json({ success: true, message: 'Student deleted successfully from students collection.' });
  } catch (error) {
    console.error('Delete student error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting student.' });
  }
});

module.exports = router;
