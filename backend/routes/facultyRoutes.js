const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const User = require('../models/User');
const { protect, protectFaculty } = require('../middleware/authMiddleware');
const { normalizeDepartment, normalizeYear, matchesDepartment, matchesYear } = require('../utils/normalization');

/**
 * Check if student belongs to the Faculty Advisor's assigned Department and Year
 */
function isStudentInFacultyScope(faculty, student) {
  const facDept = faculty.department;
  const facYear = faculty.assignedYear || faculty.year;
  return matchesDepartment(facDept, student.department) && matchesYear(facYear, student.year);
}

// @route   GET /api/faculty/students
// @desc    Get all students assigned to the logged-in Faculty Advisor + unassigned students in their dept/year
// @access  Private (Faculty Advisor only)
router.get('/students', protect, protectFaculty, async (req, res) => {
  try {
    const facultyUserId = (req.user._id || req.user.id).toString();
    const facDept = req.user.department;
    const facYear = req.user.assignedYear || req.user.year;

    // Fetch all students in the database
    const allStudents = await Student.find().select('-password').sort({ name: 1 }).lean();

    // Filter strictly to students matching this Faculty Advisor's Department and Year
    const deptYearStudents = allStudents.filter(s => isStudentInFacultyScope(req.user, s));

    // Split into assigned to this advisor vs unassigned
    const assignedStudents = deptYearStudents.filter(s =>
      s.assignedFacultyAdvisorId && s.assignedFacultyAdvisorId.toString() === facultyUserId
    );

    const unassignedStudents = deptYearStudents.filter(s =>
      !s.assignedFacultyAdvisorId
    );

    return res.json({
      success: true,
      faculty: {
        id: facultyUserId,
        name: req.user.name,
        department: facDept,
        year: facYear,
        designation: req.user.designation || `${normalizeYear(facYear)} ${facDept} Faculty Advisor`
      },
      assignedStudents,
      unassignedStudents,
      totalAssigned: assignedStudents.length,
      totalUnassigned: unassignedStudents.length
    });
  } catch (error) {
    console.error('Error fetching faculty students:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching assigned students.' });
  }
});

// @route   POST /api/faculty/students/assign
// @desc    Assign an existing student belonging to this Faculty Advisor's department & year
// @access  Private (Faculty Advisor only)
router.post('/students/assign', protect, protectFaculty, async (req, res) => {
  try {
    const { studentId, registerNumber } = req.body;
    const facultyUserId = req.user._id || req.user.id;
    const facDept = req.user.department;
    const facYear = req.user.assignedYear || req.user.year;

    if (!studentId && !registerNumber) {
      return res.status(400).json({ success: false, message: 'Student ID or Register Number is required.' });
    }

    let student = null;
    if (studentId) {
      student = await Student.findById(studentId);
    }
    if (!student && registerNumber) {
      const regClean = registerNumber.trim();
      student = await Student.findOne({
        $or: [
          { registerNumber: regClean },
          { reg: regClean },
          { username: regClean.toLowerCase() }
        ]
      });
    }

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    // Strict validation: student must belong to the Faculty Advisor's assigned Department and Year
    if (!isStudentInFacultyScope(req.user, student)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You can only assign students belonging to your assigned Department (${facDept}) and Year (${facYear}). This student is in ${student.department || 'Unknown'} - ${student.year || 'Unknown'}.`
      });
    }

    student.assignedFacultyAdvisorId = facultyUserId;
    await student.save();

    // Also sync to legacy User collection if exists
    try {
      await User.updateOne(
        { $or: [{ _id: student._id }, { username: student.username }] },
        { $set: { assignedFacultyAdvisorId: facultyUserId } }
      );
    } catch (e) {
      // ignore legacy error
    }

    return res.json({
      success: true,
      message: `Student ${student.name} (${student.registerNumber || student.reg}) successfully assigned to you.`,
      student: {
        _id: student._id,
        name: student.name,
        registerNumber: student.registerNumber || student.reg,
        department: student.department,
        year: student.year,
        status: student.status,
        assignedFacultyAdvisorId: student.assignedFacultyAdvisorId
      }
    });
  } catch (error) {
    console.error('Error assigning student to faculty:', error);
    return res.status(500).json({ success: false, message: 'Server error assigning student.' });
  }
});

// @route   POST /api/faculty/students/create-and-assign
// @desc    Create a new student in the Faculty Advisor's department & year and assign to advisor
// @access  Private (Faculty Advisor only)
router.post('/students/create-and-assign', protect, protectFaculty, async (req, res) => {
  try {
    const { name, registerNumber, reg, room, email, phone, password, homeAddress } = req.body;
    const facultyUserId = req.user._id || req.user.id;
    const facDept = normalizeDepartment(req.user.department);
    const facYear = normalizeYear(req.user.assignedYear || req.user.year);

    const finalReg = (registerNumber || reg || '').trim();

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Student Name is required.' });
    }

    if (!finalReg) {
      return res.status(400).json({ success: false, message: 'Register Number is required.' });
    }

    if (!/^8301[0-9]{8}$/.test(finalReg)) {
      return res.status(400).json({ success: false, message: 'Register No. must be 12 digits, starting with 8301.' });
    }

    const normUsername = finalReg.toLowerCase();

    // Check if student already exists
    const exists = await Student.findOne({
      $or: [
        { registerNumber: finalReg },
        { reg: finalReg },
        { username: normUsername }
      ]
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: `Student with Register No. "${finalReg}" already exists in the system. Use "Assign Existing Student" instead.`
      });
    }

    // Email validation
    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      }
      const emailExists = await Student.findOne({ email: cleanEmail });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'This email ID is already registered.' });
      }
    }

    // Phone validation
    const rawPhone = (phone || '').trim();
    let cleanPhone = '';
    if (rawPhone) {
      cleanPhone = rawPhone.replace(/[^0-9]/g, '');
      if (!/^[0-9]{10}$/.test(cleanPhone)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit phone number.' });
      }
    }

    // Default password = Student Register Number
    const initialPassword = (password && password.trim()) ? password.trim() : finalReg;
    const hasChanged = Boolean(password && password.trim() !== finalReg);

    const newStudent = await Student.create({
      name: name.trim(),
      username: normUsername,
      registerNumber: finalReg,
      reg: finalReg,
      studentId: normUsername,
      password: initialPassword,
      hasChangedPassword: hasChanged,
      room: (room || '').trim(),
      department: facDept,
      year: facYear,
      email: cleanEmail,
      phone: cleanPhone,
      homeAddress: (homeAddress || '').trim(),
      role: 'student',
      status: 'active',
      assignedFacultyAdvisorId: facultyUserId
    });

    return res.status(201).json({
      success: true,
      message: `Student ${newStudent.name} registered and assigned to you successfully.`,
      student: {
        _id: newStudent._id,
        name: newStudent.name,
        registerNumber: newStudent.registerNumber,
        department: newStudent.department,
        year: newStudent.year,
        room: newStudent.room,
        email: newStudent.email,
        phone: newStudent.phone,
        status: newStudent.status,
        assignedFacultyAdvisorId: newStudent.assignedFacultyAdvisorId
      }
    });
  } catch (error) {
    console.error('Error creating student by faculty:', error);
    return res.status(500).json({ success: false, message: 'Server error creating and assigning student.' });
  }
});

// @route   POST /api/faculty/students/:id/unassign or DELETE /api/faculty/students/:id/unassign
// @desc    Remove student's assignment from this Faculty Advisor (non-destructive; does not delete student)
// @access  Private (Faculty Advisor only)
const unassignHandler = async (req, res) => {
  try {
    const studentId = req.params.id;
    const facultyUserId = (req.user._id || req.user.id).toString();
    const facDept = req.user.department;
    const facYear = req.user.assignedYear || req.user.year;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    // Verify student belongs to this advisor's Department and Year
    if (!isStudentInFacultyScope(req.user, student)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You cannot modify students outside your assigned Department (${facDept}) and Year (${facYear}).`
      });
    }

    // Verify student is currently assigned to this advisor
    if (!student.assignedFacultyAdvisorId || student.assignedFacultyAdvisorId.toString() !== facultyUserId) {
      return res.status(400).json({
        success: false,
        message: 'Action prohibited: This student is not currently assigned to your account.'
      });
    }

    // Remove assignment only (do not delete student account)
    student.assignedFacultyAdvisorId = null;
    await student.save();

    // Also clear from legacy User collection if exists
    try {
      await User.updateOne(
        { $or: [{ _id: student._id }, { username: student.username }] },
        { $set: { assignedFacultyAdvisorId: null } }
      );
    } catch (e) {
      // ignore legacy error
    }

    return res.json({
      success: true,
      message: `Student assignment for ${student.name} (${student.registerNumber || student.reg}) has been removed. The student profile remains active in the system.`,
      studentId: student._id
    });
  } catch (error) {
    console.error('Error unassigning student:', error);
    return res.status(500).json({ success: false, message: 'Server error removing student assignment.' });
  }
};

router.post('/students/:id/unassign', protect, protectFaculty, unassignHandler);
router.delete('/students/:id/unassign', protect, protectFaculty, unassignHandler);

module.exports = router;
