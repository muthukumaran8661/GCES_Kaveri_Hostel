const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const OutRequest = require('../models/OutRequest');
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
    const { room, dest, fromDate, toDate, travel, parentPhone, reason, requestType, department } = req.body;

    if (!room || !dest || !fromDate || !toDate || !travel || !parentPhone || !reason) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (!/^[0-9]{10}$/.test(parentPhone.trim())) {
      return res.status(400).json({ success: false, message: 'Parent mobile number must be exactly 10 digits.' });
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
      department: department || req.user.department || '',
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
    const requests = await OutRequest.find({ owner: req.user.username }).sort({ createdAt: -1 });
    return res.json({ success: true, requests });
  } catch (error) {
    console.error('Get student requests error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching student requests.' });
  }
});

// @route   GET /api/requests/staff
// @desc    Get all requests for staff dashboard queues
// @access  Private (Staff)
router.get('/staff', protect, async (req, res) => {
  try {
    if (req.user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Access denied. Staff only.' });
    }
    const requests = await OutRequest.find().sort({ createdAt: -1 });
    return res.json({ success: true, requests });
  } catch (error) {
    console.error('Get staff requests error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching staff requests.' });
  }
});

// @route   PATCH /api/requests/:id/action
// @desc    Update request status / log based on action
// @access  Private (Staff/Student)
router.patch('/:id/action', protect, async (req, res) => {
  try {
    const { action } = req.body;
    const request = await findRequestById(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Out pass request not found.' });
    }

    switch (action) {
      case 'faculty_approved':
        request.status = 'pending_staff';
        request.log.push('Faculty Advisor approved — forwarded to Warden');
        break;
      case 'faculty_rejected':
        request.status = 'faculty_rejected';
        request.log.push('Faculty Advisor declined the request');
        break;
      case 'staff_approved':
        request.status = 'notifying_parent';
        request.callAttempts = 1;
        request.log.push('Warden approved — SMS/WhatsApp link sent, auto-call started (attempt 1)');
        break;
      case 'staff_rejected':
        request.status = 'staff_rejected';
        request.log.push('Warden declined the request');
        break;
      case 'parent_approved':
        request.status = 'approved_final';
        request.log.push('Parent confirmed by call/OTP — student marked OUT');
        break;
      case 'parent_rejected':
        request.status = 'parent_rejected';
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
