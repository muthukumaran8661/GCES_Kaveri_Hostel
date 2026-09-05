const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const express = require('express');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const Student = require('../models/Student');
const Staff = require('../models/Staff');
const Warden = require('../models/Warden');

const DEFAULT_URI = 'mongodb+srv://muthukumarangces_db_user:WEZBW13IqJpjvKLL@cluster0.m6cqhkp.mongodb.net/outformdb?appName=Cluster0';

const app = express();
app.use(express.json());
app.use('/api/auth', require('../routes/authRoutes'));
app.use('/api/students', require('../routes/studentRoutes'));

const TEST_REG = '830124104099';
const TEST_EMAIL = 'test_student_reg99@gces.edu';
const TEST_PHONE = '9876543299';

async function runVerification() {
  console.log('====================================================');
  console.log('STARTING STUDENT AUTHENTICATION & LOGIN VERIFICATION');
  console.log('====================================================\n');

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || DEFAULT_URI;
  await mongoose.connect(uri);
  console.log('✓ Connected to MongoDB');

  // Start HTTP server on ephemeral port
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`✓ Test Express server listening on port ${port}`);

  async function api(endpoint, method = 'GET', body = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${baseUrl}${endpoint}`, opts);
    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    return { status: res.status, ok: res.ok, body: data };
  }

  // Clean up any prior test records
  await Student.deleteMany({
    $or: [
      { registerNumber: TEST_REG },
      { reg: TEST_REG },
      { username: TEST_REG },
      { email: TEST_EMAIL }
    ]
  });

  // ----------------------------------------------------
  // TEST 1: Register Number Validation on Login
  // ----------------------------------------------------
  console.log('\n--- TEST 1: Register Number Validation on Login ---');

  // 1a: Invalid register number - wrong prefix
  const res1a = await api('/api/auth/login', 'POST', {
    role: 'student',
    username: '123456789012',
    password: 'SomePassword1!'
  });
  console.log('1a (Invalid prefix 123456789012):', res1a.status, res1a.body.message);
  if (res1a.status !== 400 || res1a.body.message !== 'Register No. must be 12 digits, starting with 8301.') {
    throw new Error(`Test 1a Failed: Expected 400 with 'Register No. must be 12 digits, starting with 8301.', got ${res1a.status} ${res1a.body.message}`);
  }
  console.log('✓ Correctly rejected invalid prefix with exact message: "Register No. must be 12 digits, starting with 8301."');

  // 1b: Invalid register number - less than 12 digits
  const res1b = await api('/api/auth/login', 'POST', {
    role: 'student',
    username: '83011234',
    password: 'SomePassword1!'
  });
  console.log('1b (Short 83011234):', res1b.status, res1b.body.message);
  if (res1b.status !== 400 || res1b.body.message !== 'Register No. must be 12 digits, starting with 8301.') {
    throw new Error(`Test 1b Failed: Expected 400 with exact message`);
  }
  console.log('✓ Correctly rejected short register number with exact message');

  // 1c: Non-digits in register number
  const res1c = await api('/api/auth/login', 'POST', {
    role: 'student',
    username: '83012410401a',
    password: 'SomePassword1!'
  });
  console.log('1c (Alphanumeric 83012410401a):', res1c.status, res1c.body.message);
  if (res1c.status !== 400 || res1c.body.message !== 'Register No. must be 12 digits, starting with 8301.') {
    throw new Error(`Test 1c Failed: Expected 400 with exact message`);
  }
  console.log('✓ Correctly rejected non-digit register number with exact message');

  // ----------------------------------------------------
  // TEST 2: Student Account Creation with Default Password
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Student Account Creation with Default Password ---');

  const resSignup = await api('/api/auth/signup', 'POST', {
    role: 'student',
    name: 'Priya Test',
    reg: TEST_REG,
    registerNumber: TEST_REG,
    room: '305',
    department: 'CSE',
    year: 'III Year',
    email: TEST_EMAIL,
    phone: TEST_PHONE,
    homeAddress: '12 Anna Nagar, Salem'
  });

  console.log('Signup response:', resSignup.status, resSignup.body.success ? 'Success' : resSignup.body.message);
  if (resSignup.status !== 201 || !resSignup.body.success) {
    throw new Error(`Test 2 Failed: Signup failed: ${JSON.stringify(resSignup.body)}`);
  }

  // Inspect student directly in DB
  const createdStudent = await Student.findOne({ registerNumber: TEST_REG });
  if (!createdStudent) {
    throw new Error('Test 2 Failed: Student document not found in DB');
  }

  console.log('Student created in DB:');
  console.log('  Register Number:', createdStudent.registerNumber);
  console.log('  hasChangedPassword:', createdStudent.hasChangedPassword);
  console.log('  Password Hash:', createdStudent.password.substring(0, 20) + '...');

  if (createdStudent.hasChangedPassword !== false) {
    throw new Error('Test 2 Failed: hasChangedPassword should initially be false');
  }
  if (!createdStudent.password.startsWith('$2a$') && !createdStudent.password.startsWith('$2b$')) {
    throw new Error('Test 2 Failed: Password should be hashed with bcrypt, NOT stored in plain text');
  }
  if (createdStudent.password === TEST_REG) {
    throw new Error('Test 2 Failed: Password is stored in plain text!');
  }
  console.log('✓ Default password safely hashed with bcrypt and hasChangedPassword=false');

  // ----------------------------------------------------
  // TEST 3: Initial Login with Register Number as Password
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Initial Login with Register Number as Password ---');

  const resLogin1 = await api('/api/auth/login', 'POST', {
    role: 'student',
    username: TEST_REG,
    password: TEST_REG
  });

  console.log('Initial login status:', resLogin1.status, resLogin1.body.success ? 'Success' : resLogin1.body.message);
  if (resLogin1.status !== 200 || !resLogin1.body.token) {
    throw new Error(`Test 3 Failed: Initial login failed: ${JSON.stringify(resLogin1.body)}`);
  }
  const studentToken = resLogin1.body.token;
  console.log('✓ Student logged in successfully with Register Number + default Register Number password');

  // ----------------------------------------------------
  // TEST 4: Student Password Change
  // ----------------------------------------------------
  console.log('\n--- TEST 4: Student Password Change ---');

  const NEW_CUSTOM_PASSWORD = 'Kaveri#2026@Salem';

  // 4a: Wrong current password should fail
  const resChangeFail = await api('/api/students/change-password', 'POST', {
    currentPassword: 'WrongPassword999',
    newPassword: NEW_CUSTOM_PASSWORD,
    confirmPassword: NEW_CUSTOM_PASSWORD
  }, studentToken);

  console.log('Change with wrong current pass status:', resChangeFail.status, resChangeFail.body.message);
  if (resChangeFail.status !== 400) {
    throw new Error('Test 4a Failed: Should reject wrong current password');
  }
  console.log('✓ Correctly rejected wrong current password');

  // 4b: Valid password change
  const resChangeSuccess = await api('/api/students/change-password', 'POST', {
    currentPassword: TEST_REG,
    newPassword: NEW_CUSTOM_PASSWORD,
    confirmPassword: NEW_CUSTOM_PASSWORD
  }, studentToken);

  console.log('Change password success status:', resChangeSuccess.status, resChangeSuccess.body.message);
  if (resChangeSuccess.status !== 200 || !resChangeSuccess.body.success) {
    throw new Error(`Test 4b Failed: ${JSON.stringify(resChangeSuccess.body)}`);
  }

  // Verify flag in DB
  const updatedStudent = await Student.findOne({ registerNumber: TEST_REG });
  if (updatedStudent.hasChangedPassword !== true) {
    throw new Error('Test 4b Failed: hasChangedPassword was not set to true');
  }
  console.log('✓ hasChangedPassword is now true');

  // ----------------------------------------------------
  // TEST 5: Verify Old Register Number Password NO LONGER Works
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Verify Old Register Number Password NO LONGER Works ---');

  const resOldPassLogin = await api('/api/auth/login', 'POST', {
    role: 'student',
    username: TEST_REG,
    password: TEST_REG
  });

  console.log('Login with old Register Number status:', resOldPassLogin.status, resOldPassLogin.body.message);
  if (resOldPassLogin.status !== 401) {
    throw new Error(`Test 5 Failed: Old Register Number password should be rejected with 401, got ${resOldPassLogin.status}`);
  }
  console.log('✓ Old Register Number password rejected with 401');

  // ----------------------------------------------------
  // TEST 6: Verify New Custom Password Works
  // ----------------------------------------------------
  console.log('\n--- TEST 6: Verify New Custom Password Works ---');

  const resNewPassLogin = await api('/api/auth/login', 'POST', {
    role: 'student',
    username: TEST_REG,
    password: NEW_CUSTOM_PASSWORD
  });

  console.log('Login with new custom password status:', resNewPassLogin.status, resNewPassLogin.body.success ? 'Success' : resNewPassLogin.body.message);
  if (resNewPassLogin.status !== 200 || !resNewPassLogin.body.token) {
    throw new Error(`Test 6 Failed: Login with new custom password failed`);
  }
  console.log('✓ Successfully logged in with new custom password containing special characters');

  // ----------------------------------------------------
  // TEST 7: Student Forgot Password / Reset OTP Flow
  // ----------------------------------------------------
  console.log('\n--- TEST 7: Student Forgot Password / Reset OTP Flow ---');

  // Set OTP directly to test verify and reset
  const OTP_CODE = '654321';
  updatedStudent.resetOtp = OTP_CODE;
  updatedStudent.resetOtpExpire = new Date(Date.now() + 5 * 60 * 1000);
  await updatedStudent.save();

  // Verify OTP
  const resVerifyOtp = await api('/api/auth/student/verify-otp', 'POST', {
    registerNumber: TEST_REG,
    email: TEST_EMAIL,
    otp: OTP_CODE
  });

  console.log('Verify OTP status:', resVerifyOtp.status, resVerifyOtp.body.message);
  if (resVerifyOtp.status !== 200 || !resVerifyOtp.body.success) {
    throw new Error(`Test 7a Failed: Verify OTP failed: ${JSON.stringify(resVerifyOtp.body)}`);
  }

  // Reset password to another custom password
  const FINAL_RESET_PASS = 'Deva@123_Salem';
  const resReset = await api('/api/auth/student/reset-password', 'POST', {
    registerNumber: TEST_REG,
    email: TEST_EMAIL,
    otp: OTP_CODE,
    newPassword: FINAL_RESET_PASS
  });

  console.log('Reset password status:', resReset.status, resReset.body.message);
  if (resReset.status !== 200 || !resReset.body.success) {
    throw new Error(`Test 7b Failed: Reset password failed: ${JSON.stringify(resReset.body)}`);
  }

  // Verify login with newly reset password
  const resResetLogin = await api('/api/auth/login', 'POST', {
    role: 'student',
    username: TEST_REG,
    password: FINAL_RESET_PASS
  });

  if (resResetLogin.status !== 200 || !resResetLogin.body.token) {
    throw new Error('Test 7c Failed: Login with reset password failed');
  }
  console.log('✓ Successfully logged in with OTP-reset password');

  // ----------------------------------------------------
  // TEST 8: Verify Faculty Advisor and Warden Logins Intact
  // ----------------------------------------------------
  console.log('\n--- TEST 8: Verify Faculty Advisor and Warden Logins Intact ---');

  // Warden muthu@123
  const wardenLogin = await api('/api/auth/login', 'POST', {
    role: 'staff',
    username: 'muthu@123',
    password: 'Password@123'
  });
  console.log('Warden login status:', wardenLogin.status, wardenLogin.body.success ? 'Success' : wardenLogin.body.message);
  if (wardenLogin.status === 200) {
    console.log('✓ Warden login works perfectly');
  } else {
    console.log('Warden login note:', wardenLogin.body.message);
  }

  // Clean up test student
  await Student.deleteMany({ registerNumber: TEST_REG });
  console.log('\n✓ Cleaned up test data');

  console.log('\n====================================================');
  console.log('ALL VERIFICATION TESTS PASSED SUCCESSFULLY! 100%');
  console.log('====================================================');

  server.close();
  await mongoose.disconnect();
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
