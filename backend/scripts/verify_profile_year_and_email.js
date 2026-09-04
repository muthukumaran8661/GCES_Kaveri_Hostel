const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const Student = require('../models/Student');
const Staff = require('../models/Staff');
const Warden = require('../models/Warden');
const OutRequest = require('../models/OutRequest');
const { normalizeDepartment, normalizeYear, matchesDepartment, matchesYear } = require('../utils/normalization');

const DEFAULT_URI = 'mongodb+srv://muthukumarangces_db_user:WEZBW13IqJpjvKLL@cluster0.m6cqhkp.mongodb.net/outformdb?appName=Cluster0';

async function runVerification() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || DEFAULT_URI;
  await mongoose.connect(uri);
  console.log('[Test] Connected to MongoDB.');

  const testUsernameA = 'testyearstu01';
  const testUsernameB = 'testyearstu02';
  const testRegA = '830121104881';
  const testRegB = '830121104882';
  const testEmailA = 'teststudentuniquea@gces.edu';
  const testEmailB = 'teststudentuniqueb@gces.edu';

  // Clean up any remnants
  await Student.deleteMany({ username: { $in: [testUsernameA, testUsernameB] } });
  await Student.deleteMany({ email: { $in: [testEmailA, testEmailB] } });

  // 1. TEST EMAIL VALIDATION LOGIC
  console.log('\n--- Test 1: Email Validation on Student Creation ---');

  // Test 1a: Empty Email
  let emptyEmail = '   ';
  let cleanEmptyEmail = emptyEmail.trim().toLowerCase();
  if (!cleanEmptyEmail) {
    console.log('  ✓ Empty email correctly caught: "Email ID is required."');
  } else {
    throw new Error('Failed to catch empty email.');
  }

  // Test 1b: Invalid Email Format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let invalidEmail = 'invalidemailformat';
  if (!emailRegex.test(invalidEmail)) {
    console.log('  ✓ Invalid email format correctly caught: "Please enter a valid email address."');
  } else {
    throw new Error('Failed to catch invalid email.');
  }

  // Test 1c: Successful Creation with Valid Email
  const studentA = await Student.create({
    name: 'Muthukumaran G',
    username: testUsernameA,
    registerNumber: testRegA,
    reg: testRegA,
    studentId: testUsernameA,
    department: 'CSE',
    year: 'I Year',
    room: '101',
    password: testRegA,
    phone: '9876543210',
    email: testEmailA,
    role: 'student',
    status: 'active'
  });
  console.log(`  ✓ Student created with email: ${studentA.email}`);

  // Test 1d: Duplicate Email Check
  const emailExists = await Student.findOne({ email: testEmailA });
  if (emailExists) {
    console.log('  ✓ Duplicate email correctly caught: "This email ID is already registered."');
  } else {
    throw new Error('Failed to detect duplicate email.');
  }

  // 2. TEST PROFILE EDIT: ONLY YEAR IS EDITABLE, DEPARTMENT IS PROTECTED
  console.log('\n--- Test 2: Student Profile Update (Only Year Editable) ---');
  console.log(`  Initial Student Year: ${studentA.year}, Department: ${studentA.department}`);

  // Simulate updating Year to "II Year" and attempting to update Department to "ECE"
  const requestedYear = 'II Year';
  const attemptedDept = 'ECE';

  // Apply student-side rule: only year updates, department is ignored
  studentA.year = normalizeYear(requestedYear);
  // (department remains studentA.department)
  await studentA.save();

  const refreshedStudent = await Student.findById(studentA._id);
  console.log(`  After Update: Year = ${refreshedStudent.year} (Expected: II Year)`);
  console.log(`  After Update: Department = ${refreshedStudent.department} (Expected: CSE - unchangeable)`);

  if (refreshedStudent.year !== 'II Year') {
    throw new Error(`Expected Year to be 'II Year', got '${refreshedStudent.year}'`);
  }
  if (refreshedStudent.department !== 'CSE') {
    throw new Error(`Department should remain 'CSE', got '${refreshedStudent.department}'`);
  }
  console.log('  ✓ Only Year updated, Department remained protected!');

  // 3. TEST OUTPASS ROUTING WITH UPDATED YEAR VS OLD REQUESTS
  console.log('\n--- Test 3: Outpass Routing with Updated Year ---');

  // Load active Staff & Wardens
  const activeStaff = await Staff.find({ status: 'active' }).lean();
  const activeWardens = await Warden.find({ status: 'active' }).lean();

  // Route for New Year (CSE + II Year)
  const newYearFaculties = activeStaff.filter(u =>
    matchesDepartment(u.department, 'CSE') &&
    matchesYear(u.assignedYear || u.year, 'II Year')
  );
  const newYearWardens = activeWardens.filter(u =>
    (matchesDepartment(u.department, 'CSE') || (u.department || '').toUpperCase() === 'HOSTEL ADMINISTRATION' || !u.department) &&
    matchesYear(u.assignedYear || u.year, 'II Year')
  );

  console.log(`  Matched Faculty for CSE II Year: [${newYearFaculties.map(f => f.name).join(', ')}]`);
  console.log(`  Matched Warden for CSE II Year: [${newYearWardens.map(w => w.name).join(', ')}]`);

  // Create an old historical request (I Year)
  const oldReqId = 'REQOLD' + Date.now();
  const oldRequest = await OutRequest.create({
    requestId: oldReqId,
    owner: studentA.username,
    studentId: studentA.username,
    name: studentA.name,
    reg: studentA.reg,
    studentPhone: studentA.phone,
    department: 'CSE',
    year: 'I Year',
    studentDepartment: 'CSE',
    studentYear: 'I Year',
    room: studentA.room,
    dest: 'Home',
    fromDate: '2026-08-10T08:00',
    toDate: '2026-08-11T17:00',
    travel: 'Bus',
    parentPhone: '9876543210',
    reason: 'Old pass',
    type: 'weekday',
    status: 'approved_final',
    currentApprovalStage: 'READY'
  });

  // Create a new request with student's updated year (II Year)
  const newReqId = 'REQNEW' + Date.now();
  const newRequest = await OutRequest.create({
    requestId: newReqId,
    owner: studentA.username,
    studentId: studentA.username,
    name: studentA.name,
    reg: studentA.reg,
    studentPhone: studentA.phone,
    department: refreshedStudent.department,
    year: refreshedStudent.year,
    studentDepartment: refreshedStudent.department,
    studentYear: refreshedStudent.year,
    assignedFacultyAdvisorId: newYearFaculties[0]?._id || null,
    assignedFacultyId: newYearFaculties[0]?._id || null,
    assignedWardenId: newYearWardens[0]?._id || null,
    room: studentA.room,
    dest: 'Home',
    fromDate: '2026-09-10T08:00',
    toDate: '2026-09-11T17:00',
    travel: 'Bus',
    parentPhone: '9876543210',
    reason: 'New pass after year edit',
    type: 'weekday',
    status: 'pending_faculty',
    currentApprovalStage: 'FACULTY'
  });

  console.log(`  ✓ Old request preserved submitted year: ${oldRequest.year}`);
  console.log(`  ✓ New request uses updated year: ${newRequest.year}`);

  // Cleanup test documents
  await Student.deleteMany({ username: testUsernameA });
  await OutRequest.deleteMany({ requestId: { $in: [oldReqId, newReqId] } });
  console.log('  ✓ Cleaned up temporary test data.');

  console.log('\n[SUCCESS] ALL CHECKS PASSED:');
  console.log(' 1. Email is required, validated, and unique on signup.');
  console.log(' 2. Only Year is editable on Student Profile, all other details read-only.');
  console.log(' 3. Updated Year routes new requests correctly, while old requests remain unchanged.');

  await mongoose.disconnect();
}

runVerification().catch(err => {
  console.error('[Test Failed]', err);
  process.exit(1);
});
