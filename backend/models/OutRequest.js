const mongoose = require('mongoose');

const OutRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    required: true,
    unique: true
  },
  owner: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true
  },
  reg: {
    type: String,
    required: true
  },
  studentPhone: {
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
  room: {
    type: String,
    required: true
  },
  dest: {
    type: String,
    required: true
  },
  fromDate: {
    type: String,
    required: true
  },
  toDate: {
    type: String,
    required: true
  },
  travel: {
    type: String,
    required: true
  },
  parentPhone: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['weekday', 'weekend', 'weekday_govt'],
    required: true
  },
  status: {
    type: String,
    enum: [
      'pending_faculty',
      'faculty_rejected',
      'pending_staff',
      'staff_rejected',
      'notifying_parent',
      'parent_rejected',
      'approved_final',
      'returned'
    ],
    required: true
  },
  callAttempts: {
    type: Number,
    default: 0
  },
  log: [{
    type: String
  }],
  facultyActionBy: {
    type: String,
    default: ''
  },
  facultyActionAt: {
    type: Date
  },
  wardenActionBy: {
    type: String,
    default: ''
  },
  wardenActionAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  qrToken: {
    type: String,
    sparse: true,
    unique: true
  },
  qrStatus: {
    type: String,
    enum: ['ACTIVE', 'OUT', 'RETURNED', 'INVALID'],
    default: 'ACTIVE'
  },
  scanCount: {
    type: Number,
    default: 0
  },
  actualOutTime: {
    type: Date,
    default: null
  },
  actualOutScannedBy: {
    type: String,
    default: ''
  },
  actualReturnTime: {
    type: Date,
    default: null
  },
  actualReturnScannedBy: {
    type: String,
    default: ''
  },
  lateReturn: {
    type: Boolean,
    default: false
  },
  lateReturnDuration: {
    type: String,
    default: ''
  },
  invalidScanAttemptsCount: {
    type: Number,
    default: 0
  },
  gpsLocations: [{
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('OutRequest', OutRequestSchema);
