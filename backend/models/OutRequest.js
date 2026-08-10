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
  department: {
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
    enum: ['weekday', 'weekend'],
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
