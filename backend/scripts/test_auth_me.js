const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const connectDB = require('../config/db');
const Student = require('../models/Student');
const Staff = require('../models/Staff');
const Warden = require('../models/Warden');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

async function testMe() {
  await connectDB();
  console.log('--- Testing /api/auth/me flow ---');

  // Let's find any student or create a temporary student
  let student = await Student.findOne();
  if (!student) {
    console.log('No student found, creating one...');
    student = await Student.create({
      name: 'Test Student',
      username: 'teststudent1',
      studentId: 'teststudent1',
      password: 'password',
      reg: '830112345678',
      role: 'student',
      status: 'active',
      department: 'CSE',
      year: 'I Year',
      email: 'teststudent@example.com',
      phone: '9876543210'
    });
  }

  console.log('Using student:', {
    _id: student._id,
    name: student.name,
    role: student.role,
    status: student.status
  });

  const token = jwt.sign({
    id: student._id,
    userId: student._id,
    role: 'student',
    department: student.department || '',
    assignedYear: student.year || ''
  }, process.env.JWT_SECRET || 'gces_kaveri_hostel_secret_key', {
    expiresIn: '30d'
  });

  console.log('Generated token for student.');

  // Now simulate protect middleware call
  const req = {
    headers: {
      authorization: `Bearer ${token}`
    }
  };

  let statusCode = 200;
  let statusMessage = '';
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      statusMessage = data;
      return this;
    }
  };

  let nextCalled = false;
  await protect(req, res, () => {
    nextCalled = true;
  });

  console.log('Protect result:', { nextCalled, statusCode, statusMessage, reqUser: req.user ? { id: req.user._id, role: req.user.role } : null });

  // Now test with Staff / Faculty
  let staff = await Staff.findOne();
  if (staff) {
    console.log('\nTesting Staff / Faculty:', { id: staff._id, role: staff.role });
    const staffToken = jwt.sign({
      id: staff._id,
      userId: staff._id,
      role: 'faculty',
      department: staff.department || '',
      assignedYear: staff.assignedYear || staff.year || ''
    }, process.env.JWT_SECRET || 'gces_kaveri_hostel_secret_key', { expiresIn: '30d' });

    const reqStaff = { headers: { authorization: `Bearer ${staffToken}` } };
    let staffNext = false;
    await protect(reqStaff, res, () => { staffNext = true; });
    console.log('Staff protect result:', { staffNext, statusCode, statusMessage, reqUser: reqStaff.user ? { id: reqStaff.user._id, role: reqStaff.user.role } : null });
  }

  // Now test with Warden
  let warden = await Warden.findOne();
  if (warden) {
    console.log('\nTesting Warden:', { id: warden._id, role: warden.role });
    const wardenToken = jwt.sign({
      id: warden._id,
      userId: warden._id,
      role: 'staff',
      department: warden.department || '',
      assignedYear: warden.assignedYear || warden.year || ''
    }, process.env.JWT_SECRET || 'gces_kaveri_hostel_secret_key', { expiresIn: '30d' });

    const reqWarden = { headers: { authorization: `Bearer ${wardenToken}` } };
    let wardenNext = false;
    await protect(reqWarden, res, () => { wardenNext = true; });
    console.log('Warden protect result:', { wardenNext, statusCode, statusMessage, reqUser: reqWarden.user ? { id: reqWarden.user._id, role: reqWarden.user.role } : null });
  }

  process.exit(0);
}

testMe().catch(err => {
  console.error(err);
  process.exit(1);
});
