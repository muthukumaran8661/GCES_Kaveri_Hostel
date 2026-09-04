const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');
const OutRequest = require('../models/OutRequest');
const User = require('../models/User');
const { protect, protectWarden, protectFaculty, protectStaffOrFaculty } = require('../middleware/authMiddleware');
const { normalizeDepartment, normalizeYear, matchesDepartment, matchesYear } = require('../utils/normalization');

function uid() {
  return 'REQ' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

async function findRequestById(id) {
  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const query = isObjectId
    ? { $or: [{ requestId: id }, { _id: id }] }
    : { requestId: id };
  return await OutRequest.findOne(query);
}

// @route   POST /api/requests
// @desc    Create a new out request
// @access  Private (Student)
router.post('/', protect, async (req, res) => {
  try {
    const { room, dest, fromDate, toDate, travel, parentPhone, reason, requestType, department, year } = req.body;

    if (!room || !dest || !fromDate || !toDate || !travel || !parentPhone || !reason) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (!/^[0-9]{10}$/.test(parentPhone.trim())) {
      return res.status(400).json({ success: false, message: 'Parent mobile number must be exactly 10 digits.' });
    }

    // BACKEND 1-MINUTE (60 SECONDS) COOLDOWN & DUPLICATE SUBMISSION CHECK
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentRequest = await OutRequest.findOne({
      owner: req.user.username,
      createdAt: { $gte: oneMinuteAgo }
    }).sort({ createdAt: -1 });

    if (recentRequest) {
      const elapsedSec = Math.floor((Date.now() - new Date(recentRequest.createdAt).getTime()) / 1000);
      const remainingSec = Math.max(1, 60 - elapsedSec);
      return res.status(400).json({
        success: false,
        message: `Please wait ${remainingSec} second${remainingSec > 1 ? 's' : ''} before submitting another outpass request.`,
        remainingSeconds: remainingSec
      });
    }

    // BACKEND DATE & TIME VALIDATION
    const now = new Date();
    const yearNum = now.getFullYear();
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const dayStr = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yearNum}-${monthStr}-${dayStr}`;
    const hoursStr = String(now.getHours()).padStart(2, '0');
    const minsStr = String(now.getMinutes()).padStart(2, '0');
    const currentHHmm = `${hoursStr}:${minsStr}`;

    const fromParts = String(fromDate).split('T');
    const toParts = String(toDate).split('T');

    if (fromParts.length !== 2 || toParts.length !== 2) {
      return res.status(400).json({ success: false, message: 'Invalid Date & Time format.' });
    }

    const [fromDatePart, fromTimePart] = fromParts;
    const [toDatePart, toTimePart] = toParts;

    // 1. OUT DATE & TIME restrictions
    if (fromDatePart < todayStr) {
      return res.status(400).json({ success: false, message: 'Out Date cannot be in the past. Only Today and future dates are allowed.' });
    }
    if (fromTimePart < '05:00' || fromTimePart > '18:00') {
      return res.status(400).json({ success: false, message: 'Out Time must be between 05:00 AM and 06:00 PM.' });
    }
    if (fromDatePart === todayStr && fromDate < `${todayStr}T${currentHHmm}`) {
      return res.status(400).json({ success: false, message: 'Out Date & Time cannot be in the past.' });
    }

    // 2. EXPECTED RETURN restrictions
    if (toDatePart < todayStr) {
      return res.status(400).json({ success: false, message: 'Expected Return date cannot be in the past. Only Today and future dates are allowed.' });
    }
    if (toTimePart < '05:00' || toTimePart > '18:00') {
      return res.status(400).json({ success: false, message: 'Expected Return time must be between 05:00 AM and 06:00 PM.' });
    }
    if (toDatePart === todayStr && toDate < `${todayStr}T${currentHHmm}`) {
      return res.status(400).json({ success: false, message: 'Expected Return date & time cannot be in the past.' });
    }

    // 3. Expected Return > Out Date & Time
    const fromTimeMs = new Date(fromDate).getTime();
    const toTimeMs = new Date(toDate).getTime();
    if (isNaN(fromTimeMs) || isNaN(toTimeMs)) {
      return res.status(400).json({ success: false, message: 'Invalid Out or Return Date & Time.' });
    }

    if (toTimeMs <= fromTimeMs) {
      return res.status(400).json({ success: false, message: 'Expected Return date & time must be after Out Date & Time.' });
    }

    const validTypes = ['weekday', 'weekend', 'weekday_govt'];
    const type = validTypes.includes(requestType) ? requestType : 'weekend';

    // SERVER-SIDE REQUEST TYPE VALIDATION
    const [yNum, mNum, dNum] = fromDatePart.split('-').map(Number);
    const [hNum, minNum] = fromTimePart.split(':').map(Number);
    const outDateObj = new Date(yNum, mNum - 1, dNum);
    const dayOfWeek = outDateObj.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
    const outMinutes = hNum * 60 + minNum;

    // RULE 1 — WEEKDAY / EMERGENCY OUT PASS (Faculty & Warden Approval)
    if (type === 'weekday') {
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return res.status(400).json({
          success: false,
          message: 'Weekday / Emergency Out Pass is valid only from Monday 05:00 AM to Friday 04:30 PM. Please select Weekend Out Pass for weekend dates.'
        });
      }
      if (dayOfWeek === 5 && outMinutes > 990) {
        return res.status(400).json({
          success: false,
          message: 'The selected out time falls under Weekend Out Pass timing. Please select a valid Outpass Type: Weekend Out Pass (Warden Approval).'
        });
      }
    }

    // RULE 2 — WEEKEND OUT PASS (Warden Approval)
    if (type === 'weekend') {
      if (dayOfWeek >= 1 && dayOfWeek <= 4) {
        return res.status(400).json({
          success: false,
          message: 'Weekend Out Pass timing starts from Friday 04:31 PM through Sunday. For weekdays, please select Weekday / Emergency Out Pass or Weekday / Government Holiday Out Pass.'
        });
      }
      if (dayOfWeek === 5 && outMinutes <= 990) {
        return res.status(400).json({
          success: false,
          message: 'Friday timing up to 04:30 PM falls under Weekday Out Pass. Weekend Out Pass timing starts from Friday 04:31 PM.'
        });
      }
    }

    // RULE 3 — WEEKDAY / GOVERNMENT HOLIDAY OUT PASS (Warden Approval)
    if (type === 'weekday_govt') {
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return res.status(400).json({
          success: false,
          message: 'Weekday / Government Holiday Out Pass is valid only on weekdays (Monday 05:00 AM to Friday 06:00 PM).'
        });
      }
    }

    // DYNAMIC MASTER ASSIGNMENT ROUTING & VALIDATION
    const studentDept = normalizeDepartment(req.user.department || department);
    const studentYear = normalizeYear(req.user.year || year);

    // Query active Faculty and Wardens
    const activeStaffUsers = await User.find({
      role: { $in: ['faculty', 'staff'] },
      status: 'active'
    }).lean();

    // Match Faculty Advisors for this student's Department and Year
    const matchedFaculties = activeStaffUsers.filter(u =>
      u.role === 'faculty' &&
      matchesDepartment(u.department, studentDept) &&
      matchesYear(u.year, studentYear)
    );

    // Match Wardens for this student's Year and Department (or general hostel administration)
    const matchedWardens = activeStaffUsers.filter(u =>
      u.role === 'staff' &&
      (matchesDepartment(u.department, studentDept) || normalizeDepartment(u.department) === 'HOSTEL ADMINISTRATION' || !u.department) &&
      matchesYear(u.year, studentYear)
    );

    console.log(`[ROUTING] Student Dept: ${studentDept}, Year: ${studentYear}`);
    console.log(`[ROUTING] Matched Faculty: [${matchedFaculties.map(f => f.staffId || f.username || f._id).join(', ')}]`);
    console.log(`[ROUTING] Matched Warden: [${matchedWardens.map(w => w.staffId || w.username || w._id).join(', ')}]`);

    // Strict validation
    if (type === 'weekday') {
      if (matchedFaculties.length === 0 || matchedWardens.length === 0) {
        console.error(`[ROUTING ERROR] No active Faculty Advisor or Warden found for student ${req.user.username} (${studentDept} - ${studentYear}). Matched Faculty: ${matchedFaculties.length}, Matched Warden: ${matchedWardens.length}`);
        return res.status(400).json({
          success: false,
          message: 'No active Faculty Advisor/Warden is assigned to your department and year. Please contact the administrator.'
        });
      }
    } else {
      if (matchedWardens.length === 0) {
        console.error(`[ROUTING ERROR] No active Warden found for student ${req.user.username} (${studentDept} - ${studentYear}).`);
        return res.status(400).json({
          success: false,
          message: 'No active Faculty Advisor/Warden is assigned to your department and year. Please contact the administrator.'
        });
      }
    }

    const assignedFacultyId = matchedFaculties[0]?._id || null;
    const assignedWardenId = matchedWardens[0]?._id || null;
    const currentApprovalStage = type === 'weekday' ? 'FACULTY' : 'WARDEN';
    const status = type === 'weekday' ? 'pending_faculty' : 'pending_staff';
    const initialLog = type === 'weekday'
      ? `Submitted by student (${studentDept} - ${studentYear}) — awaiting Faculty Advisor (${matchedFaculties[0]?.name || 'Assigned Faculty'})`
      : `Submitted by student (${studentDept} - ${studentYear}) — awaiting Warden (${matchedWardens[0]?.name || 'Assigned Warden'})`;

    const requestId = uid();

    const request = await OutRequest.create({
      requestId,
      owner: req.user.username,
      studentId: req.user.username,
      name: req.user.name,
      reg: req.user.reg || '',
      studentPhone: req.user.phone || '',
      department: studentDept,
      year: studentYear,
      studentDepartment: studentDept,
      studentYear: studentYear,
      assignedFacultyAdvisorId: assignedFacultyId,
      assignedFacultyId,
      assignedWardenId,
      currentApprovalStage,
      room,
      dest,
      fromDate,
      toDate,
      travel,
      parentPhone,
      reason,
      type,
      status,
      callAttempts: 0,
      log: [initialLog]
    });

    return res.status(201).json({
      success: true,
      request
    });
  } catch (error) {
    console.error('Create request error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating request.' });
  }
});

// @route   GET /api/requests/student
// @desc    Get logged in student's requests
// @access  Private (Student)
router.get('/student', protect, async (req, res) => {
  try {
    const requests = await OutRequest.find({ owner: req.user.username }).sort({ createdAt: -1 }).lean();
    const enriched = await Promise.all(requests.map(async r => {
      let token = r.qrToken;
      let status = r.qrStatus || 'ACTIVE';

      if (['approved_final', 'returned'].includes(r.status) && !token) {
        token = `${r.requestId || 'REQ'}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        status = r.status === 'returned' ? 'RETURNED' : 'ACTIVE';
        await OutRequest.updateOne({ _id: r._id }, { $set: { qrToken: token, qrStatus: status } });
      }

      const currentApprovalStage = r.currentApprovalStage || (
        r.status === 'pending_faculty' ? 'FACULTY' :
        r.status === 'pending_staff' ? 'WARDEN' :
        r.status === 'notifying_parent' ? 'PARENT' :
        r.status === 'approved_final' ? 'READY' :
        r.status === 'returned' ? 'RETURNED' : 'REJECTED'
      );

      return {
        ...r,
        currentApprovalStage,
        qrToken: token || r.qrToken,
        qrStatus: status,
        department: normalizeDepartment(req.user.department || r.department || ''),
        year: normalizeYear(req.user.year || r.year || ''),
        studentPhone: req.user.phone || r.studentPhone || ''
      };
    }));
    return res.json({ success: true, requests: enriched });
  } catch (error) {
    console.error('Get student requests error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching student requests.' });
  }
});

// Helper to enrich requests with fresh Student Profile & Status Information
async function enrichRequestsWithStudentInfo(allRequests) {
  const studentUsers = await User.find({ role: 'student' }).select('username reg department year phone name').lean();
  const userMap = new Map();
  studentUsers.forEach(u => {
    if (u.username) userMap.set(u.username.toLowerCase(), u);
    if (u.reg) userMap.set(u.reg.toLowerCase(), u);
  });

  return await Promise.all(allRequests.map(async r => {
    const u = userMap.get((r.owner || '').toLowerCase()) || userMap.get((r.reg || '').toLowerCase());
    let token = r.qrToken;
    let status = r.qrStatus || 'ACTIVE';

    if (['approved_final', 'returned'].includes(r.status) && !token) {
      token = `${r.requestId || 'REQ'}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      status = r.status === 'returned' ? 'RETURNED' : 'ACTIVE';
      await OutRequest.updateOne({ _id: r._id }, { $set: { qrToken: token, qrStatus: status } });
    }

    const reqDept = normalizeDepartment(u?.department || r.department || r.studentDepartment || '');
    const reqYear = normalizeYear(u?.year || r.year || r.studentYear || '');
    const currentApprovalStage = r.currentApprovalStage || (
      r.status === 'pending_faculty' ? 'FACULTY' :
      r.status === 'pending_staff' ? 'WARDEN' :
      r.status === 'notifying_parent' ? 'PARENT' :
      r.status === 'approved_final' ? 'READY' :
      r.status === 'returned' ? 'RETURNED' : 'REJECTED'
    );

    return {
      ...r,
      currentApprovalStage,
      qrToken: token || r.qrToken,
      qrStatus: status,
      studentId: r.studentId || r.owner || '',
      studentDepartment: reqDept,
      studentYear: reqYear,
      assignedFacultyAdvisorId: r.assignedFacultyAdvisorId || r.assignedFacultyId || null,
      assignedWardenId: r.assignedWardenId || null,
      department: reqDept,
      year: reqYear,
      studentPhone: u?.phone || r.studentPhone || ''
    };
  }));
}

// @route   GET /api/requests/warden
// @desc    Get requests assigned to the logged-in Warden
// @access  Private (Warden/Admin)
router.get('/warden', protect, protectWarden, async (req, res) => {
  try {
    const allRequests = await OutRequest.find().sort({ createdAt: -1 }).lean();
    const enrichedRequests = await enrichRequestsWithStudentInfo(allRequests);

    const wardenDept = normalizeDepartment(req.user.department);
    const filtered = enrichedRequests.filter(r => {
      if (req.user.role === 'admin') return true;

      // Filter: student.department matches loggedInWarden.department (or general hostel administration)
      if (wardenDept && wardenDept !== 'HOSTEL ADMINISTRATION' && !matchesDepartment(wardenDept, r.department)) {
        return false;
      }

      // Filter: student.year matches loggedInWarden.assignedYear
      if (!matchesYear(req.user.year, r.year)) {
        return false;
      }

      // Suppress weekday requests before Faculty Advisor approval
      if (r.type === 'weekday' && (r.status === 'pending_faculty' || r.currentApprovalStage === 'FACULTY')) {
        return false;
      }

      // Optional stage filter if query parameter is passed (e.g. ?stage=WARDEN)
      if (req.query.stage && r.currentApprovalStage !== req.query.stage) {
        return false;
      }

      return true;
    });

    return res.json({ success: true, requests: filtered });
  } catch (error) {
    console.error('Get warden requests error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching warden requests.' });
  }
});

// @route   GET /api/requests/faculty
// @desc    Get requests assigned to the logged-in Faculty Advisor
// @access  Private (Faculty Advisor)
router.get('/faculty', protect, protectFaculty, async (req, res) => {
  try {
    const allRequests = await OutRequest.find().sort({ createdAt: -1 }).lean();
    const enrichedRequests = await enrichRequestsWithStudentInfo(allRequests);

    const filtered = enrichedRequests.filter(r => {
      // Filter: student.department matches loggedInFaculty.department
      if (!matchesDepartment(req.user.department, r.department)) {
        return false;
      }

      // Filter: student.year matches loggedInFaculty.assignedYear
      if (!matchesYear(req.user.year, r.year)) {
        return false;
      }

      // Optional stage filter if query parameter is passed (e.g. ?stage=FACULTY)
      if (req.query.stage && r.currentApprovalStage !== req.query.stage) {
        return false;
      }

      return true;
    });

    return res.json({ success: true, requests: filtered });
  } catch (error) {
    console.error('Get faculty requests error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching faculty requests.' });
  }
});

// @route   GET /api/requests/staff
// @desc    Backward compatible staff/faculty request endpoint with role-aware delegation
// @access  Private (Staff/Faculty/Admin)
router.get('/staff', protect, protectStaffOrFaculty, async (req, res) => {
  try {
    const allRequests = await OutRequest.find().sort({ createdAt: -1 }).lean();
    const enrichedRequests = await enrichRequestsWithStudentInfo(allRequests);

    // Role-aware delegation for Faculty Advisor
    if (req.user.role === 'faculty') {
      const filtered = enrichedRequests.filter(r => {
        return matchesDepartment(req.user.department, r.department) &&
               matchesYear(req.user.year, r.year);
      });
      return res.json({ success: true, requests: filtered });
    }

    // Role-aware delegation for Warden (Staff)
    if (req.user.role === 'staff') {
      const wardenDept = normalizeDepartment(req.user.department);
      const filtered = enrichedRequests.filter(r => {
        if (!matchesYear(req.user.year, r.year)) return false;
        if (wardenDept && wardenDept !== 'HOSTEL ADMINISTRATION' && !matchesDepartment(wardenDept, r.department)) {
          return false;
        }
        if (r.type === 'weekday' && (r.status === 'pending_faculty' || r.currentApprovalStage === 'FACULTY')) {
          return false;
        }
        return true;
      });
      return res.json({ success: true, requests: filtered });
    }

    // Admin sees all
    return res.json({ success: true, requests: enrichedRequests });
  } catch (error) {
    console.error('Get staff requests error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching staff requests.' });
  }
});

// @route   PATCH /api/requests/:id/action
// @desc    Update request status / log based on action
// @access  Private (Staff/Faculty/Student)
router.patch('/:id/action', protect, protectStaffOrFaculty, async (req, res) => {
  try {
    const { action } = req.body;
    const request = await findRequestById(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Out pass request not found.' });
    }

    // STRICT BACKEND AUTHORIZATION FOR FACULTY APPROVAL / DECLINE
    if (action === 'faculty_approved' || action === 'faculty_rejected') {
      if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '403 Forbidden: Only assigned Faculty Advisors are authorized to take action on this request.'
        });
      }

      if (req.user.role === 'faculty') {
        if (!matchesDepartment(req.user.department, request.department) ||
            !matchesYear(req.user.year, request.year)) {
          return res.status(403).json({
            success: false,
            message: `403 Forbidden: You are not authorized to take action on this student's request. Your assignment (${req.user.department || 'N/A'} - ${req.user.year || 'N/A'}) does not match Student (${request.department || 'N/A'} - ${request.year || 'N/A'}).`
          });
        }
      }
    }

    // STRICT BACKEND AUTHORIZATION FOR WARDEN APPROVAL / DECLINE
    if (action === 'staff_approved' || action === 'staff_rejected') {
      if (req.user.role !== 'staff' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '403 Forbidden: Only assigned Wardens are authorized to take action on this request.'
        });
      }

      if (req.user.role === 'staff') {
        if (!matchesYear(req.user.year, request.year)) {
          return res.status(403).json({
            success: false,
            message: `403 Forbidden: You are not authorized to approve requests for ${request.year || 'this Year'}. Your assignment is ${req.user.year || 'N/A'}.`
          });
        }

        const wardenDept = normalizeDepartment(req.user.department);
        if (wardenDept && wardenDept !== 'HOSTEL ADMINISTRATION' && !matchesDepartment(wardenDept, request.department)) {
          return res.status(403).json({
            success: false,
            message: `403 Forbidden: You are not authorized for department ${request.department}.`
          });
        }

        if (request.type === 'weekday' && (request.status === 'pending_faculty' || request.currentApprovalStage === 'FACULTY')) {
          return res.status(403).json({
            success: false,
            message: '403 Forbidden: Weekday out pass requires Faculty Advisor approval before Warden approval.'
          });
        }
      }
    }

    switch (action) {
      case 'faculty_approved':
        request.status = 'pending_staff';
        request.currentApprovalStage = 'WARDEN';
        request.facultyActionBy = req.user.name || req.user.staffId || req.user.username;
        request.facultyActionAt = new Date();
        request.facultyAdvisorApprovedAt = new Date();
        // Dynamically find and store assignedWardenId for the student's department and year
        {
          const activeWardens = await User.find({ role: 'staff', status: 'active' }).lean();
          const matchedWardens = activeWardens.filter(u =>
            (matchesDepartment(u.department, request.department) || normalizeDepartment(u.department) === 'HOSTEL ADMINISTRATION' || !u.department) &&
            matchesYear(u.year, request.year)
          );
          if (matchedWardens.length > 0) {
            request.assignedWardenId = matchedWardens[0]._id;
          }
        }
        request.log.push(`Faculty Advisor: ${req.user.name}${req.user.staffId ? ` (ID: ${req.user.staffId})` : ''} Approved — forwarded to Warden`);
        break;
      case 'faculty_rejected':
        request.status = 'faculty_rejected';
        request.currentApprovalStage = 'REJECTED';
        request.facultyActionBy = req.user.name || req.user.staffId || req.user.username;
        request.facultyActionAt = new Date();
        request.rejectionReason = req.body.reason || 'Declined by Faculty Advisor';
        request.log.push(`Faculty Advisor: ${req.user.name}${req.user.staffId ? ` (ID: ${req.user.staffId})` : ''} Declined the request`);
        break;
      case 'staff_approved':
        request.status = 'notifying_parent';
        request.currentApprovalStage = 'PARENT';
        request.wardenActionBy = req.user.name || req.user.username;
        request.wardenActionAt = new Date();
        request.wardenApprovedAt = new Date();
        request.callAttempts = 1;
        request.log.push(`Warden (${req.user.name}) approved — SMS/WhatsApp link sent, auto-call started (attempt 1)`);
        break;
      case 'staff_rejected':
        request.status = 'staff_rejected';
        request.currentApprovalStage = 'REJECTED';
        request.wardenActionBy = req.user.name || req.user.username;
        request.wardenActionAt = new Date();
        request.rejectionReason = req.body.reason || 'Declined by Warden';
        request.log.push(`Warden (${req.user.name}) declined the request`);
        break;
      case 'parent_approved':
        request.status = 'approved_final';
        request.currentApprovalStage = 'READY';
        request.parentApprovedAt = new Date();
        if (!request.qrToken) {
          const randHex = crypto.randomBytes(3).toString('hex').toUpperCase();
          request.qrToken = `${request.requestId || 'REQ'}-${randHex}`;
          request.qrStatus = 'ACTIVE';
        }
        request.log.push('Parent confirmed by call/OTP — Out Pass APPROVED and QR code generated');
        break;
      case 'parent_rejected':
        request.status = 'parent_rejected';
        request.currentApprovalStage = 'REJECTED';
        request.rejectionReason = req.body.reason || 'Declined by Parent';
        request.log.push('Parent declined the request');
        break;
      case 'returned':
        request.status = 'returned';
        request.currentApprovalStage = 'RETURNED';
        request.qrStatus = 'RETURNED';
        request.log.push('Student checked back in at hostel gate');
        break;
      case 'retry_call':
        if (request.status === 'notifying_parent') {
          if (request.callAttempts < 3) {
            request.callAttempts += 1;
            request.log.push(`No answer — redialling parent (attempt ${request.callAttempts})`);
          } else {
            request.log.push('3 call attempts unanswered — link still active, follow up manually');
          }
        }
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid action provided.' });
    }

    await request.save();

    return res.json({ success: true, request });
  } catch (error) {
    console.error('Update request action error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating request action.' });
  }
});

// @route   GET /api/requests/report
// @desc    Get detailed report & analytics data with strict RBAC
// @access  Private (Warden/Faculty/Admin only)
router.get('/report', protect, protectStaffOrFaculty, async (req, res) => {
  try {
    const allRequests = await OutRequest.find().sort({ createdAt: -1 }).lean();
    const studentUsers = await User.find({ role: 'student' }).select('username reg department year phone name room homeAddress').lean();
    
    const userMap = new Map();
    studentUsers.forEach(u => {
      if (u.username) userMap.set(u.username.toLowerCase(), u);
      if (u.reg) userMap.set(u.reg.toLowerCase(), u);
    });

    const enriched = allRequests.map(r => {
      const u = userMap.get((r.owner || '').toLowerCase()) || userMap.get((r.reg || '').toLowerCase());
      return {
        ...r,
        department: normalizeDepartment(u?.department || r.department || ''),
        year: normalizeYear(u?.year || r.year || ''),
        room: r.room || u?.room || '',
        dest: r.dest || u?.homeAddress || '',
        parentPhone: r.parentPhone || '',
        parentMobile: r.parentPhone || ''
      };
    });

    if (req.user.role === 'faculty') {
      const scopedRequests = enriched.filter(r => {
        return matchesDepartment(req.user.department, r.department) &&
               matchesYear(req.user.year, r.year);
      });

      return res.json({ success: true, requests: scopedRequests });
    }

    if (req.user.role === 'staff') {
      const scopedRequests = enriched.filter(r => {
        if (!matchesYear(req.user.year, r.year)) return false;
        const wardenDept = normalizeDepartment(req.user.department);
        if (wardenDept && wardenDept !== 'HOSTEL ADMINISTRATION' && !matchesDepartment(wardenDept, r.department)) return false;
        return true;
      });

      return res.json({ success: true, requests: scopedRequests });
    }

    return res.json({ success: true, requests: enriched });
  } catch (error) {
    console.error('Get report data error:', error);
    return res.status(500).json({ success: false, message: 'Server error generating report data.' });
  }
});

// @route   PATCH /api/requests/:id/location
// @desc    Update GPS location for an approved out request
// @access  Private (Student - owner only)
router.patch('/:id/location', protect, async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (lat == null || lng == null) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required.' });
    }

    const request = await findRequestById(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Out pass request not found.' });
    }

    // Only the owner can share location
    if (request.owner !== req.user.username) {
      return res.status(403).json({ success: false, message: 'You can only share your own location.' });
    }

    // Only allow location sharing on active requests (not rejected or returned)
    if (['faculty_rejected', 'staff_rejected', 'parent_rejected', 'returned'].includes(request.status)) {
      return res.status(400).json({ success: false, message: 'Location sharing is not available for completed or rejected passes.' });
    }

    request.gpsLocations.push({ lat, lng, timestamp: new Date() });

    // Keep only last 50 location entries
    if (request.gpsLocations.length > 50) {
      request.gpsLocations = request.gpsLocations.slice(-50);
    }

    await request.save();

    return res.json({ success: true, request });
  } catch (error) {
    console.error('Update location error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating location.' });
  }
});

module.exports = router;
