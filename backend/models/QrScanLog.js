const mongoose = require('mongoose');

const QrScanLogSchema = new mongoose.Schema({
  requestId: {
    type: String,
    default: ''
  },
  qrToken: {
    type: String,
    required: true,
    index: true
  },
  studentId: {
    type: String,
    default: ''
  },
  studentName: {
    type: String,
    default: ''
  },
  regNumber: {
    type: String,
    default: ''
  },
  department: {
    type: String,
    default: ''
  },
  year: {
    type: String,
    default: ''
  },
  scanTimestamp: {
    type: Date,
    default: Date.now
  },
  scannedBy: {
    type: String,
    default: 'Gate Staff'
  },
  scannerUserId: {
    type: String,
    default: ''
  },
  scannerRole: {
    type: String,
    default: ''
  },
  scanResult: {
    type: String,
    enum: [
      'VALID_OUT',
      'VALID_BACK',
      'INVALID_ALREADY_USED',
      'INVALID_TOKEN',
      'INVALID_STATUS',
      'UNAUTHORIZED_SCANNER',
      'EXPIRED'
    ],
    required: true
  },
  previousQrStatus: {
    type: String,
    default: 'NONE'
  },
  actionAttempted: {
    type: String,
    enum: ['VERIFY', 'MARK OUT', 'MARK BACK'],
    default: 'VERIFY'
  },
  failureReason: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  }
});

module.exports = mongoose.model('QrScanLog', QrScanLogSchema);
