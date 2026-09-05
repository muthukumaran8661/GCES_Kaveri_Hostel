const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const StudentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  registerNumber: {
    type: String,
    default: ''
  },
  reg: {
    type: String,
    default: ''
  },
  studentId: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: '',
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    default: '',
    trim: true
  },
  department: {
    type: String,
    default: '',
    trim: true
  },
  year: {
    type: String,
    default: '',
    trim: true
  },
  room: {
    type: String,
    default: '',
    trim: true
  },
  homeAddress: {
    type: String,
    default: '',
    trim: true
  },
  role: {
    type: String,
    default: 'student'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  password: {
    type: String,
    required: true
  },
  resetOtp: {
    type: String,
    default: ''
  },
  resetOtpExpire: {
    type: Date,
    default: null
  },
  hasChangedPassword: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'students'
});

// Hash password before saving if modified
StudentSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match password method
StudentSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Student', StudentSchema, 'students');
