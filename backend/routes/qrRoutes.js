const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const OutRequest = require('../models/OutRequest');
const QrScanLog = require('../models/QrScanLog');
const { protect, protectWardenAllowlist } = require('../middleware/authMiddleware');

function parseDateStr(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function calcDurationString(ms) {
  if (ms <= 0) return '0 mins';
  const totalMins = Math.floor(ms / (1000 * 60));
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) {
    return `${hrs} hr${hrs > 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
  }
  return `${mins} min${mins !== 1 ? 's' : ''}`;
}

async function recordAuditLog({
  request,
  qrToken,
  reqUser,
  scanResult,
  previousQrStatus,
  actionAttempted,
  failureReason = '',
  req
}) {
  try {
    const logData = {
      requestId: request ? (request.requestId || request._id) : '',
      qrToken: qrToken || (request ? request.qrToken : ''),
      studentId: request ? (request.reg || request.owner || '') : '',
      studentName: request ? (request.name || '') : '',
      regNumber: request ? (request.reg || '') : '',
      department: request ? (request.department || '') : '',
      year: request ? (request.year || '') : '',
      scanTimestamp: new Date(),
      scannedBy: reqUser ? (reqUser.name || reqUser.username || 'Gate Staff') : 'Gate Staff',
      scannerUserId: reqUser ? (reqUser._id || reqUser.id || '') : '',
      scannerRole: reqUser ? reqUser.role : 'gate_staff',
      scanResult,
      previousQrStatus: previousQrStatus || (request ? request.qrStatus : 'NONE'),
      actionAttempted,
      failureReason,
      ipAddress: req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') : '',
      userAgent: req ? (req.headers['user-agent'] || '') : ''
    };
    await QrScanLog.create(logData);
  } catch (err) {
    console.error('Error creating QrScanLog entry:', err);
  }
}

// @route   POST /api/qr/verify
// @desc    Verify QR token, return current status and pass details, log scan attempt
// @access  Public or Protected
router.post('/verify', async (req, res) => {
  try {
    const token = (req.body.qrToken || req.body.token || '').trim();
    if (!token) {
      return res.status(400).json({ success: false, message: 'QR token is required' });
    }

    const request = await OutRequest.findOne({
      $or: [{ qrToken: token }, { requestId: token.toUpperCase() }]
    });

    const reqUser = req.user || null;

    if (!request) {
      await recordAuditLog({
        request: null,
        qrToken: token,
        reqUser,
        scanResult: 'INVALID_TOKEN',
        previousQrStatus: 'NONE',
        actionAttempted: 'VERIFY',
        failureReason: 'QR token not found in database',
        req
      });
      return res.status(404).json({
        success: false,
        scanResult: 'INVALID_TOKEN',
        message: '❌ INVALID OUT PASS — QR code or token not recognized in system.'
      });
    }

    const currentStatus = request.qrStatus || 'ACTIVE';

    if (currentStatus === 'ACTIVE') {
      await recordAuditLog({
        request,
        qrToken: request.qrToken || token,
        reqUser,
        scanResult: 'VALID_OUT',
        previousQrStatus: 'ACTIVE',
        actionAttempted: 'VERIFY',
        req
      });

      return res.json({
        success: true,
        scanResult: 'VALID_OUT',
        currentQrStatus: 'ACTIVE',
        canMarkOut: true,
        canMarkBack: false,
        message: '✓ VALID OUT PASS — Ready for MARK OUT',
        request
      });
    }

    if (currentStatus === 'OUT') {
      await recordAuditLog({
        request,
        qrToken: request.qrToken || token,
        reqUser,
        scanResult: 'VALID_BACK',
        previousQrStatus: 'OUT',
        actionAttempted: 'VERIFY',
        req
      });

      return res.json({
        success: true,
        scanResult: 'VALID_BACK',
        currentQrStatus: 'OUT',
        canMarkOut: false,
        canMarkBack: true,
        message: '✓ VALID OUT PASS — 🟢 CURRENTLY OUT — Ready for MARK BACK',
        request
      });
    }

    // Status is RETURNED or INVALID -> Permanently Invalid
    request.invalidScanAttemptsCount = (request.invalidScanAttemptsCount || 0) + 1;
    await request.save();

    await recordAuditLog({
      request,
      qrToken: request.qrToken || token,
      reqUser,
      scanResult: 'INVALID_ALREADY_USED',
      previousQrStatus: currentStatus,
      actionAttempted: 'VERIFY',
      failureReason: 'QR code already used for both OUT and BACK',
      req
    });

    return res.status(400).json({
      success: false,
      scanResult: 'INVALID_ALREADY_USED',
      currentQrStatus: currentStatus,
      message: '❌ INVALID OUT PASS — This QR code has already been used for both OUT and BACK.',
      request
    });
  } catch (err) {
    console.error('QR Verify error:', err);
    return res.status(500).json({ success: false, message: 'Server error verifying QR code' });
  }
});

// @route   POST /api/qr/mark-out
// @desc    Perform MARK OUT action (Status ACTIVE -> OUT)
// @access  Private (Staff/Warden/Faculty/Admin)
router.post('/mark-out', protect, protectWardenAllowlist, async (req, res) => {
  try {
    if (!['staff', 'faculty', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Gate Staff / Warden authorization required.' });
    }

    const token = (req.body.qrToken || req.body.token || req.body.requestId || '').trim();
    if (!token) {
      return res.status(400).json({ success: false, message: 'QR token or Request ID is required.' });
    }

    const targetReq = await OutRequest.findOne({
      $or: [{ qrToken: token }, { requestId: token.toUpperCase() }]
    });

    if (!targetReq) {
      await recordAuditLog({
        request: null,
        qrToken: token,
        reqUser: req.user,
        scanResult: 'INVALID_TOKEN',
        previousQrStatus: 'NONE',
        actionAttempted: 'MARK OUT',
        failureReason: 'Pass not found',
        req
      });
      return res.status(404).json({ success: false, message: '❌ INVALID OUT PASS — Token not found.' });
    }

    if (targetReq.qrStatus !== 'ACTIVE') {
      targetReq.invalidScanAttemptsCount = (targetReq.invalidScanAttemptsCount || 0) + 1;
      await targetReq.save();

      await recordAuditLog({
        request: targetReq,
        qrToken: targetReq.qrToken || token,
        reqUser: req.user,
        scanResult: targetReq.qrStatus === 'RETURNED' ? 'INVALID_ALREADY_USED' : 'INVALID_STATUS',
        previousQrStatus: targetReq.qrStatus,
        actionAttempted: 'MARK OUT',
        failureReason: `Cannot MARK OUT when QR status is ${targetReq.qrStatus}`,
        req
      });

      const msg = targetReq.qrStatus === 'RETURNED'
        ? '❌ INVALID OUT PASS — This QR code has already been used for both OUT and BACK.'
        : `❌ INVALID OUT PASS — Cannot MARK OUT. Pass is currently ${targetReq.qrStatus}.`;

      return res.status(400).json({ success: false, scanResult: 'INVALID_STATUS', message: msg, request: targetReq });
    }

    const now = new Date();
    const scannedByName = req.user.name || req.user.staffId || req.user.username || 'Gate Staff';

    const updated = await OutRequest.findOneAndUpdate(
      { _id: targetReq._id, qrStatus: 'ACTIVE' },
      {
        $set: {
          qrStatus: 'OUT',
          scanCount: 1,
          actualOutTime: now,
          actualOutScannedBy: scannedByName
        },
        $push: {
          log: `Marked OUT at hostel gate by ${scannedByName} at ${now.toLocaleString('en-IN')}`
        }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: '❌ State Conflict: Duplicate simultaneous scan or pass is no longer ACTIVE.'
      });
    }

    await recordAuditLog({
      request: updated,
      qrToken: updated.qrToken || token,
      reqUser: req.user,
      scanResult: 'VALID_OUT',
      previousQrStatus: 'ACTIVE',
      actionAttempted: 'MARK OUT',
      req
    });

    return res.json({
      success: true,
      message: `✓ MARK OUT successful for ${updated.name} (${updated.reg})`,
      request: updated
    });
  } catch (err) {
    console.error('Mark OUT error:', err);
    return res.status(500).json({ success: false, message: 'Server error during MARK OUT.' });
  }
});

// @route   POST /api/qr/mark-back
// @desc    Perform MARK BACK action (Status OUT -> RETURNED)
// @access  Private (Staff/Warden/Faculty/Admin)
router.post('/mark-back', protect, protectWardenAllowlist, async (req, res) => {
  try {
    if (!['staff', 'faculty', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Gate Staff / Warden authorization required.' });
    }

    const token = (req.body.qrToken || req.body.token || req.body.requestId || '').trim();
    if (!token) {
      return res.status(400).json({ success: false, message: 'QR token or Request ID is required.' });
    }

    const targetReq = await OutRequest.findOne({
      $or: [{ qrToken: token }, { requestId: token.toUpperCase() }]
    });

    if (!targetReq) {
      await recordAuditLog({
        request: null,
        qrToken: token,
        reqUser: req.user,
        scanResult: 'INVALID_TOKEN',
        previousQrStatus: 'NONE',
        actionAttempted: 'MARK BACK',
        failureReason: 'Pass not found',
        req
      });
      return res.status(404).json({ success: false, message: '❌ INVALID OUT PASS — Token not found.' });
    }

    if (targetReq.qrStatus !== 'OUT') {
      targetReq.invalidScanAttemptsCount = (targetReq.invalidScanAttemptsCount || 0) + 1;
      await targetReq.save();

      await recordAuditLog({
        request: targetReq,
        qrToken: targetReq.qrToken || token,
        reqUser: req.user,
        scanResult: targetReq.qrStatus === 'RETURNED' ? 'INVALID_ALREADY_USED' : 'INVALID_STATUS',
        previousQrStatus: targetReq.qrStatus,
        actionAttempted: 'MARK BACK',
        failureReason: `Cannot MARK BACK when QR status is ${targetReq.qrStatus}`,
        req
      });

      const msg = targetReq.qrStatus === 'RETURNED'
        ? '❌ INVALID OUT PASS — This QR code has already been used for both OUT and BACK.'
        : `❌ INVALID OUT PASS — Cannot MARK BACK. Pass state is ${targetReq.qrStatus}.`;

      return res.status(400).json({ success: false, scanResult: 'INVALID_STATUS', message: msg, request: targetReq });
    }

    const now = new Date();
    const scannedByName = req.user.name || req.user.staffId || req.user.username || 'Gate Staff';

    let isLate = false;
    let lateDurationStr = '';
    const expDate = parseDateStr(targetReq.toDate);
    if (expDate && now > expDate) {
      isLate = true;
      lateDurationStr = calcDurationString(now.getTime() - expDate.getTime());
    }

    const updated = await OutRequest.findOneAndUpdate(
      { _id: targetReq._id, qrStatus: 'OUT' },
      {
        $set: {
          status: 'returned',
          qrStatus: 'RETURNED',
          scanCount: 2,
          actualReturnTime: now,
          actualReturnScannedBy: scannedByName,
          lateReturn: isLate,
          lateReturnDuration: lateDurationStr
        },
        $push: {
          log: `Marked BACK at hostel gate by ${scannedByName} at ${now.toLocaleString('en-IN')}${isLate ? ` [⚠ LATE RETURN by ${lateDurationStr}]` : ' [Safe Return]'}`
        }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: '❌ State Conflict: Pass is no longer in OUT status.'
      });
    }

    await recordAuditLog({
      request: updated,
      qrToken: updated.qrToken || token,
      reqUser: req.user,
      scanResult: 'VALID_BACK',
      previousQrStatus: 'OUT',
      actionAttempted: 'MARK BACK',
      req
    });

    return res.json({
      success: true,
      message: `✓ MARK BACK successful for ${updated.name}. Status: Returned Safe.${isLate ? ` (⚠ Late Return by ${lateDurationStr})` : ''}`,
      request: updated
    });
  } catch (err) {
    console.error('Mark BACK error:', err);
    return res.status(500).json({ success: false, message: 'Server error during MARK BACK.' });
  }
});

// @route   GET /api/qr/audit-logs
// @desc    Fetch QR scan audit logs for Wardens and Admins
// @access  Private (Staff/Warden/Faculty/Admin)
router.get('/audit-logs', protect, protectWardenAllowlist, async (req, res) => {
  try {
    if (!['staff', 'faculty', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { limit = 100, scanResult, searchQuery } = req.query;
    const filter = {};

    if (scanResult && scanResult !== 'ALL') {
      filter.scanResult = scanResult;
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim();
      filter.$or = [
        { requestId: new RegExp(q, 'i') },
        { studentName: new RegExp(q, 'i') },
        { regNumber: new RegExp(q, 'i') },
        { scannedBy: new RegExp(q, 'i') },
        { qrToken: new RegExp(q, 'i') }
      ];
    }

    const logs = await QrScanLog.find(filter)
      .sort({ scanTimestamp: -1 })
      .limit(parseInt(limit, 10))
      .lean();

    return res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    console.error('Fetch audit logs error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching QR scan logs.' });
  }
});

module.exports = router;
