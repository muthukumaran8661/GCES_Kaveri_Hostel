const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const WardenSchema = new mongoose.Schema({
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
  staffId: {
    type: String,
    required: true,
    trim: true
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
    default: 'Hostel Administration',
    trim: true
  },
  assignedYear: {
    type: String,
    default: 'All Years',
    trim: true
  },
  year: {
    type: String,
    trim: true
  },
  designation: {
    type: String,
    default: 'Warden',
    trim: true
  },
  role: {
    type: String,
    enum: ['Warden', 'staff', 'admin'],
    default: 'Warden'
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
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'wardens'
});

// Sync year with assignedYear before saving
WardenSchema.pre('save', async function () {
  if (this.assignedYear && !this.year) {
    this.year = this.assignedYear;
  } else if (this.year && !this.assignedYear) {
    this.assignedYear = this.year;
  }

  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match password method
WardenSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Warden', WardenSchema, 'wardens');
