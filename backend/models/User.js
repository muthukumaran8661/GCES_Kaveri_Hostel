const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['student', 'faculty', 'staff', 'admin'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  reg: {
    type: String,
    default: ''
  },
  room: {
    type: String,
    default: ''
  },
  studentId: {
    type: String,
    default: ''
  },
  staffId: {
    type: String,
    default: ''
  },
  designation: {
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
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  email: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  homeAddress: {
    type: String,
    default: ''
  },
  resetOtp: {
    type: String,
    default: ''
  },
  resetOtpExpire: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving if modified
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match password method
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
