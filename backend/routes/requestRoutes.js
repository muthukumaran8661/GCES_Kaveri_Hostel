const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const OutRequest = require('../models/OutRequest');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

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

    const type = requestType === 'weekday' ? 'weekday' : 'weekend';
    const status = type === 'weekday' ? 'pending_faculty' : 'pending_staff';
    const initialLog = type === 'weekday'
      ? 'Submitted by student — awaiting Faculty Advisor'
      : 'Submitted by student — awaiting Warden';

    const requestId = uid();

    const request = await OutRequest.create({
      requestId,
      owner: req.user.username,
      name: req.user.name,
      reg: req.user.reg || '',
      studentPhone: req.user.phone || '',
      department: req.user.department || department || '',
      year: req.user.year || year || '',
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
    const enriched = requests.map(r => ({
      ...r,
      department: req.user.department || r.department || '',
      year: req.user.year || r.year || '',
      studentPhone: req.user.phone || r.studentPhone || ''
    }));
    return res.json({ success: true, requests: enriched });
  } catch (error) {
    console.error('Get student requests error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching student requests.' });
  }
});

function normalizeYearKey(y) {
  if (!y) return '';
  const s = String(y).trim();
  if (/^I(\s+Year)?$/i.test(s) || /^1(st)?(\s+Year)?$/i.test(s)) return 'I';
  if (/^II(\s+Year)?$/i.test(s) || /^2(nd)?(\s+Year)?$/i.test(s)) return 'II';
  if (/^III(\s+Year)?$/i.test(s) || /^3(rd)?(\s+Year)?$/i.test(s)) return 'III';
  if (/^IV(\s+Year)?$/i.test(s) || /^4(th)?(\s+Year)?$/i.test(s)) return 'IV';
  if (/ALL/i.test(s)) return 'ALL';
  return s.toUpperCase();
}

// @route   GET /api/requests/staff
// @desc    Get all requests for staff/faculty dashboard queues
// @access  Private (Staff/Faculty/Admin)
router.get('/staff', protect, async (req, res) => {
  try {
    if (!['staff', 'faculty', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Warden/Admin or Faculty only.' });
    }

    const allRequests = await OutRequest.find().sort({ createdAt: -1 }).lean();

    // Enrich requests with latest student User profile database data
    const studentUsers = await User.find({ role: 'student' }).select('username reg department year phone name').lean();
    const userMap = new Map();
    studentUsers.forEach(u => {
      if (u.username) userMap.set(u.username.toLowerCase(), u);
      if (u.reg) userMap.set(u.reg.toLowerCase(), u);
    });

    const enrichedRequests = allRequests.map(r => {
      const u = userMap.get((r.owner || '').toLowerCase()) || userMap.get((r.reg || '').toLowerCase());
      return {
        ...r,
        department: u?.department || r.department || '',
        year: u?.year || r.year || '',
        studentPhone: u?.phone || r.studentPhone || ''
      };
    });

    // Dynamic Faculty Filter: Faculty members ONLY see requests matching their assigned Department + Year
    if (req.user.role === 'faculty') {
      const facDept = (req.user.department || '').trim().toLowerCase();
      const facYear = normalizeYearKey(req.user.year);

      const filtered = enrichedRequests.filter(r => {
        const reqDept = (r.department || '').trim().toLowerCase();
        const reqYear = normalizeYearKey(r.year);
        return reqDept === facDept && (facYear === 'ALL' || reqYear === facYear);
      });
      return res.json({ success: true, requests: filtered });
    }

    return res.json({ success: true, requests: enrichedRequests });
  } catch (error) {
    console.error('Get staff requests error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching staff requests.' });
  }
});

// @route   PATCH /api/requests/:id/action
// @desc    Update request status / log based on action
// @access  Private (Staff/Faculty/Student)
router.patch('/:id/action', protect, async (req, res) => {
  try {
    const { action } = req.body;
    const request = await findRequestById(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Out pass request not found.' });
    }

    // STRICT BACKEND AUTHORIZATION FOR FACULTY APPROVAL / DECLINE
    if (action === 'faculty_approved' || action === 'faculty_rejected') {
      if (req.user.status === 'inactive') {
        return res.status(403).json({
          success: false,
          message: '403 Forbidden: Your faculty account is inactive. Please contact Administrator.'
        });
      }

      if (req.user.role !== 'faculty' && req.user.role !== 'admin' && req.user.role !== 'staff') {
        return res.status(403).json({
          success: false,
          message: '403 Forbidden: Only assigned Faculty Advisors are authorized to take action on this request.'
        });
      }

      if (req.user.role === 'faculty') {
        const facDept = (req.user.department || '').trim().toLowerCase();
        const facYear = normalizeYearKey(req.user.year);
        const reqDept = (request.department || '').trim().toLowerCase();
        const reqYear = normalizeYearKey(request.year);

        if (!facDept || !facYear || facDept !== reqDept || (facYear !== 'ALL' && facYear !== reqYear)) {
          return res.status(403).json({
            success: false,
            message: `403 Forbidden: You are not authorized to approve this student's request. Your assignment (${req.user.department || 'N/A'} - ${req.user.year || 'N/A'}) does not match Student (${request.department || 'N/A'} - ${request.year || 'N/A'}).`
          });
        }
      }
    }

    switch (action) {
      case 'faculty_approved':
        request.status = 'pending_staff';
        request.facultyActionBy = req.user.name || req.user.username;
        request.facultyActionAt = new Date();
        request.log.push(`Faculty Advisor (${req.user.name}) approved — forwarded to Warden`);
        break;
      case 'faculty_rejected':
        request.status = 'faculty_rejected';
        request.facultyActionBy = req.user.name || req.user.username;
        request.facultyActionAt = new Date();
        request.rejectionReason = req.body.reason || 'Declined by Faculty Advisor';
        request.log.push(`Faculty Advisor (${req.user.name}) declined the request`);
        break;
      case 'staff_approved':
        request.status = 'notifying_parent';
        request.wardenActionBy = req.user.name || req.user.username;
        request.wardenActionAt = new Date();
        request.callAttempts = 1;
        request.log.push(`Warden (${req.user.name}) approved — SMS/WhatsApp link sent, auto-call started (attempt 1)`);
        break;
      case 'staff_rejected':
        request.status = 'staff_rejected';
        request.wardenActionBy = req.user.name || req.user.username;
        request.wardenActionAt = new Date();
        request.rejectionReason = req.body.reason || 'Declined by Warden';
        request.log.push(`Warden (${req.user.name}) declined the request`);
        break;
      case 'parent_approved':
        request.status = 'approved_final';
        request.log.push('Parent confirmed by call/OTP — student marked OUT');
        break;
      case 'parent_rejected':
        request.status = 'parent_rejected';
        request.rejectionReason = req.body.reason || 'Declined by Parent';
        request.log.push('Parent declined the request');
        break;
      case 'returned':
        request.status = 'returned';
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
router.get('/report', protect, async (req, res) => {
  try {
    if (!['staff', 'faculty', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Report generation is restricted to authorized Staff and Faculty Advisors.' });
    }

    if (req.user.role === 'faculty' && req.user.status === 'inactive') {
      return res.status(403).json({ success: false, message: '403 Forbidden: Your faculty account is inactive. Please contact Administrator.' });
    }

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
        department: u?.department || r.department || '',
        year: u?.year || r.year || '',
        room: r.room || u?.room || '',
        dest: r.dest || u?.homeAddress || '',
        parentPhone: r.parentPhone || '',
        parentMobile: r.parentPhone || ''
      };
    });

    if (req.user.role === 'faculty') {
      const facDept = (req.user.department || '').trim().toLowerCase();
      const facYear = normalizeYearKey(req.user.year);

      const scopedRequests = enriched.filter(r => {
        const reqDept = (r.department || '').trim().toLowerCase();
        const reqYear = normalizeYearKey(r.year);
        return reqDept === facDept && (facYear === 'ALL' || reqYear === facYear);
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
