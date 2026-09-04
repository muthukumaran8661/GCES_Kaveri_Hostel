const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const StaffSchema = new mongoose.Schema({
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
    required: true,
    trim: true
  },
  assignedYear: {
    type: String,
    required: true,
    trim: true
  },
  year: {
    type: String,
    trim: true
  },
  designation: {
    type: String,
    default: 'Faculty Advisor',
    trim: true
  },
  role: {
    type: String,
    default: 'Faculty Advisor'
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
  collection: 'staff'
});

// Sync year with assignedYear before saving
StaffSchema.pre('save', async function () {
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
StaffSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Staff', StaffSchema, 'staff');
