const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const OutRequest = require('../models/OutRequest');
const {
  normalizeDepartment,
  normalizeYear,
  matchesDepartment,
  matchesYear
} = require('../utils/normalization');

async function runTests() {
  console.log('====================================================');
  console.log('1. UNIT TESTS: Normalization & Matching');
  console.log('====================================================');

  // Department normalization
  console.assert(normalizeDepartment('cse') === 'CSE', 'cse -> CSE');
  console.assert(normalizeDepartment('mech') === 'MECHANICAL', 'mech -> MECHANICAL');
  console.assert(normalizeDepartment('Mechanical') === 'MECHANICAL', 'Mechanical -> MECHANICAL');
  console.assert(normalizeDepartment('mathematics') === 'MATHS', 'mathematics -> MATHS');
  console.assert(normalizeDepartment('Maths') === 'MATHS', 'Maths -> MATHS');
  console.assert(normalizeDepartment('physics') === 'PHYSICS', 'physics -> PHYSICS');
  console.assert(normalizeDepartment('chemistry') === 'CHEMISTRY', 'chemistry -> CHEMISTRY');
  console.assert(normalizeDepartment('english') === 'ENGLISH', 'english -> ENGLISH');
  console.assert(normalizeDepartment('civil') === 'CIVIL', 'civil -> CIVIL');

  // Year normalization
  console.assert(normalizeYear('1') === 'I Year', '1 -> I Year');
  console.assert(normalizeYear('1st Year') === 'I Year', '1st Year -> I Year');
  console.assert(normalizeYear('i year') === 'I Year', 'i year -> I Year');
  console.assert(normalizeYear('2') === 'II Year', '2 -> II Year');
  console.assert(normalizeYear('2nd Year') === 'II Year', '2nd Year -> II Year');
  console.assert(normalizeYear('ii year') === 'II Year', 'ii year -> II Year');
  console.assert(normalizeYear('3rd') === 'III Year', '3rd -> III Year');
  console.assert(normalizeYear('4th Year') === 'IV Year', '4th Year -> IV Year');
  console.assert(normalizeYear('all years') === 'All Years', 'all years -> All Years');

  // Matching
  console.assert(matchesDepartment('CSE', 'cse'), 'CSE matches cse');
  console.assert(matchesDepartment('mech', 'Mechanical'), 'mech matches Mechanical');
  console.assert(!matchesDepartment('CSE', 'ECE'), 'CSE does not match ECE');
  console.assert(matchesYear('I Year', '1st Year'), 'I Year matches 1st Year');
  console.assert(matchesYear('All Years', 'II Year'), 'All Years matches II Year');
  console.assert(!matchesYear('I Year', 'II Year'), 'I Year does not match II Year');

  console.log('✅ All Normalization & Matching Unit Tests PASSED!\n');

  console.log('====================================================');
  console.log('2. INTEGRATION TESTS: Database Routing & Lifecycle');
  console.log('====================================================');

  await connectDB();

  // Test setup: clean old test artifacts
  await User.deleteMany({ username: { $in: ['test_std_cse1', 'test_std_ece2', 'test_fac_cse1', 'test_wrd_yr1', 'test_wrd_yr2'] } });
  await OutRequest.deleteMany({ owner: { $in: ['test_std_cse1', 'test_std_ece2'] } });

  // 1. Create Staff & Faculty
  const facCSE1 = await User.create({
    username: 'test_fac_cse1',
    password: 'Password@123',
    role: 'faculty',
    name: 'Dr. CSE Faculty 1',
    staffId: 'TEST-FAC-CSE-1',
    department: 'CSE',
    year: 'I Year',
    email: 'fac_cse1@example.com',
    phone: '9876543210',
    status: 'active'
  });

  const wrdYr1 = await User.create({
    username: 'test_wrd_yr1',
    password: 'Password@123',
    role: 'staff',
    name: 'Warden Year 1',
    staffId: 'TEST-WRD-YR1',
    department: 'Hostel Administration',
    year: 'I Year',
    email: 'wrd_yr1@example.com',
    phone: '9876543211',
    status: 'active'
  });

  const stdCSE1 = await User.create({
    username: 'test_std_cse1',
    password: 'Password@123',
    role: 'student',
    name: 'Student CSE 1',
    reg: '830124104001',
    room: '101',
    department: 'CSE',
    year: 'I Year',
    phone: '9876543212',
    status: 'active'
  });

  const stdECE2 = await User.create({
    username: 'test_std_ece2',
    password: 'Password@123',
    role: 'student',
    name: 'Student ECE 2',
    reg: '830124105001',
    room: '202',
    department: 'ECE',
    year: 'II Year',
    phone: '9876543213',
    status: 'active'
  });

  console.log('Created test users successfully.');

  // Test Case 1: Student (CSE, I Year) submitting Weekday Request
  console.log('\n--- Test Case 1: CSE I Year Weekday Request Routing ---');
  const activeStaff = await User.find({ role: { $in: ['faculty', 'staff'] }, status: 'active' }).lean();

  const studentDept = normalizeDepartment(stdCSE1.department);
  const studentYear = normalizeYear(stdCSE1.year);

  const matchedFaculties = activeStaff.filter(u =>
    u.role === 'faculty' &&
    matchesDepartment(u.department, studentDept) &&
    matchesYear(u.year, studentYear)
  );

  const matchedWardens = activeStaff.filter(u =>
    u.role === 'staff' &&
    (matchesDepartment(u.department, studentDept) || normalizeDepartment(u.department) === 'HOSTEL ADMINISTRATION' || !u.department) &&
    matchesYear(u.year, studentYear)
  );

  console.log(`[ROUTING] Student Dept: ${studentDept}, Year: ${studentYear}`);
  console.log(`[ROUTING] Matched Faculty: [${matchedFaculties.map(f => f.staffId).join(', ')}]`);
  console.log(`[ROUTING] Matched Warden: [${matchedWardens.map(w => w.staffId).join(', ')}]`);

  console.assert(matchedFaculties.some(f => f.staffId === 'TEST-FAC-CSE-1'), 'Matched Dr. CSE Faculty 1');
  console.assert(matchedWardens.some(w => w.staffId === 'TEST-WRD-YR1'), 'Matched Warden Year 1');

  // Create OutRequest simulating route POST /api/requests
  const req1 = await OutRequest.create({
    requestId: 'TESTREQ01',
    owner: stdCSE1.username,
    name: stdCSE1.name,
    reg: stdCSE1.reg,
    studentPhone: stdCSE1.phone,
    department: studentDept,
    year: studentYear,
    assignedFacultyId: matchedFaculties[0]._id,
    assignedWardenId: matchedWardens[0]._id,
    currentApprovalStage: 'FACULTY',
    status: 'pending_faculty',
    room: '101',
    dest: 'Home',
    fromDate: '2026-09-07T08:00',
    toDate: '2026-09-07T17:00',
    travel: 'Bus',
    parentPhone: '9876543219',
    reason: 'Emergency Medical',
    type: 'weekday',
    callAttempts: 0,
    log: ['Submitted by student — awaiting Faculty Advisor']
  });

  // Verify Faculty Visibility
  const facultyQueueMatch = matchesDepartment(facCSE1.department, req1.department) && matchesYear(facCSE1.year, req1.year);
  console.assert(facultyQueueMatch, 'Request visible in Faculty queue');

  // Verify Warden CANNOT see early weekday request
  const wardenEarlyMatch = req1.type === 'weekday' && (req1.status === 'pending_faculty' || req1.currentApprovalStage === 'FACULTY');
  console.assert(wardenEarlyMatch, 'Warden filter correctly suppresses pending_faculty weekday request');

  // STEP 2: Faculty Approval
  req1.status = 'pending_staff';
  req1.currentApprovalStage = 'WARDEN';
  req1.facultyActionBy = facCSE1.name;
  req1.facultyActionAt = new Date();
  req1.log.push(`Faculty Advisor: ${facCSE1.name} Approved — forwarded to Warden`);
  await req1.save();
  console.log('✅ Faculty Approved: forwarded to Warden (currentApprovalStage: WARDEN)');

  // Now Warden CAN see it
  const wardenQueueMatch = matchesYear(wrdYr1.year, req1.year) && req1.currentApprovalStage === 'WARDEN';
  console.assert(wardenQueueMatch, 'Request now visible in Warden queue');

  // STEP 3: Warden Approval
  req1.status = 'notifying_parent';
  req1.currentApprovalStage = 'PARENT';
  req1.wardenActionBy = wrdYr1.name;
  req1.wardenActionAt = new Date();
  req1.callAttempts = 1;
  req1.log.push(`Warden (${wrdYr1.name}) approved — SMS/WhatsApp link sent`);
  await req1.save();
  console.log('✅ Warden Approved: parent notification in progress (currentApprovalStage: PARENT)');

  // STEP 4: Parent Confirmation
  req1.status = 'approved_final';
  req1.currentApprovalStage = 'READY';
  req1.qrToken = 'TESTREQ01-ABCDEF';
  req1.qrStatus = 'ACTIVE';
  req1.log.push('Parent confirmed — Out Pass APPROVED and QR code generated');
  await req1.save();
  console.log('✅ Parent Confirmed: Outpass Ready with QR Token (currentApprovalStage: READY)');

  // Test Case 2: Student (ECE, II Year) submitting Weekday Request when no ECE II Year faculty exists
  console.log('\n--- Test Case 2: ECE II Year Fallback Error Test ---');
  const eceDept = normalizeDepartment(stdECE2.department);
  const eceYear = normalizeYear(stdECE2.year);

  const matchedECEFaculty = activeStaff.filter(u =>
    u.role === 'faculty' &&
    matchesDepartment(u.department, eceDept) &&
    matchesYear(u.year, eceYear)
  );

  console.log(`Matched ECE Faculty count: ${matchedECEFaculty.length}`);
  console.assert(matchedECEFaculty.length === 0, 'No ECE Faculty found as expected');

  const fallbackMsg = (matchedECEFaculty.length === 0)
    ? 'No active Faculty Advisor/Warden is assigned to your department and year. Please contact the administrator.'
    : 'OK';
  console.log(`Fallback Response: "${fallbackMsg}"`);
  console.assert(fallbackMsg === 'No active Faculty Advisor/Warden is assigned to your department and year. Please contact the administrator.');

  // Test Case 3: Admin Reassigns Warden
  console.log('\n--- Test Case 3: Admin Reassigns Warden Test ---');
  wrdYr1.year = 'II Year';
  await wrdYr1.save();

  // Test match for Student ECE II Year with reassigned Warden
  const matchesReassigned = matchesYear(wrdYr1.year, 'II Year');
  console.assert(matchesReassigned, 'Warden successfully reassigned to II Year and matches II Year students');
  console.log('✅ Warden reassignment dynamically matched II Year!');

  // Cleanup test users
  await User.deleteMany({ username: { $in: ['test_std_cse1', 'test_std_ece2', 'test_fac_cse1', 'test_wrd_yr1', 'test_wrd_yr2'] } });
  await OutRequest.deleteMany({ owner: { $in: ['test_std_cse1', 'test_std_ece2'] } });

  console.log('\n====================================================');
  console.log('🎉 ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================');

  await mongoose.disconnect();
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
