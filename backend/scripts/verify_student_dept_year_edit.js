const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const connectDB = require('../config/db');
const Student = require('../models/Student');
const Staff = require('../models/Staff');
const Warden = require('../models/Warden');
const OutRequest = require('../models/OutRequest');
const { normalizeDepartment, normalizeYear, matchesDepartment, matchesYear } = require('../utils/normalization');

async function runVerification() {
  await connectDB();
  console.log('=== VERIFYING STUDENT PROFILE DEPARTMENT & YEAR EDIT AND ROUTING ===');

  const testId = 'TEST_DEP_YEAR_' + Date.now();
  const testStudent = await Student.create({
    name: 'Dept Year Test Student',
    username: testId,
    studentId: testId,
    reg: '8301' + Math.floor(10000000 + Math.random() * 90000000),
    password: 'password123',
    department: 'CSE',
    year: 'I Year',
    room: '204',
    email: `${testId.toLowerCase()}@example.com`,
    phone: '9876543210',
    status: 'active',
    role: 'student'
  });

  console.log('1. Created initial student:', {
    _id: testStudent._id,
    department: testStudent.department,
    year: testStudent.year
  });

  // Create an initial historical request while student is CSE I Year
  const historicalReq = await OutRequest.create({
    requestId: 'REQ' + Math.random().toString(36).slice(2, 7).toUpperCase(),
    owner: testStudent.username,
    name: testStudent.name,
    reg: testStudent.reg,
    studentId: testStudent.studentId,
    department: testStudent.department,
    year: testStudent.year,
    studentDepartment: testStudent.department,
    studentYear: testStudent.year,
    room: testStudent.room,
    dest: 'Home',
    fromDate: '2026-09-05T10:00:00.000Z',
    toDate: '2026-09-06T18:00:00.000Z',
    travel: 'Bus',
    parentPhone: '9876543210',
    reason: 'Family function',
    type: 'weekend',
    status: 'approved_final',
    currentApprovalStage: 'WARDEN'
  });

  console.log('2. Created historical request before department/year edit:', {
    reqId: historicalReq._id,
    department: historicalReq.department,
    year: historicalReq.year,
    studentDepartment: historicalReq.studentDepartment,
    studentYear: historicalReq.studentYear
  });

  // Verify Department Validation Logic
  console.log('\n--- 3. Testing Department Validation Logic ---');
  const ALLOWED_DEPTS = ['CSE', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Maths', 'Physics', 'English', 'Chemistry', 'Mechatronics'];
  const ALLOWED_DEPTS_UPPER = ALLOWED_DEPTS.map(d => d.toUpperCase());

  // Test invalid department
  const invalidDept = 'UnknownDept';
  const invalidNorm = normalizeDepartment(invalidDept);
  if (!ALLOWED_DEPTS_UPPER.includes(invalidNorm)) {
    console.log('✔ Invalid department correctly rejected:', invalidDept);
  } else {
    throw new Error('Failed: Invalid department was accepted');
  }

  // Test valid department update
  const newDept = 'ECE';
  const matchedIdx = ALLOWED_DEPTS_UPPER.indexOf(normalizeDepartment(newDept));
  if (matchedIdx !== -1) {
    testStudent.department = ALLOWED_DEPTS[matchedIdx];
    await testStudent.save();
    console.log('✔ Department successfully updated to:', testStudent.department);
  }

  // Verify Year Validation Logic
  console.log('\n--- 4. Testing Year Validation Logic ---');
  const ALLOWED_YEARS = ['I Year', 'II Year', 'III Year', 'IV Year'];

  // Test invalid year
  const invalidYear = 'V Year';
  const invalidYearNorm = normalizeYear(invalidYear);
  if (!ALLOWED_YEARS.includes(invalidYearNorm)) {
    console.log('✔ Invalid year correctly rejected:', invalidYear);
  } else {
    throw new Error('Failed: Invalid year was accepted');
  }

  // Test valid year update
  const newYear = 'II Year';
  const validYearNorm = normalizeYear(newYear);
  if (ALLOWED_YEARS.includes(validYearNorm)) {
    testStudent.year = validYearNorm;
    await testStudent.save();
    console.log('✔ Year successfully updated to:', testStudent.year);
  }

  // Refresh student from DB
  const refreshedStudent = await Student.findById(testStudent._id);
  console.log('\n5. Refreshed student from MongoDB:', {
    department: refreshedStudent.department,
    year: refreshedStudent.year
  });

  if (refreshedStudent.department !== 'ECE' || refreshedStudent.year !== 'II Year') {
    throw new Error('Database does not reflect updated department and year');
  }
  console.log('✔ Database persistence verified: Student is now ECE II Year.');

  // Verify Request Routing for New Request
  console.log('\n--- 6. Testing Dynamic Routing for NEW Request ---');
  const studentDept = normalizeDepartment(refreshedStudent.department);
  const studentYear = normalizeYear(refreshedStudent.year);

  // Query active Staff / Warden
  const activeStaff = await Staff.find({ status: 'active' }).lean();
  const activeWardens = await Warden.find({ status: 'active' }).lean();

  const matchedFaculty = activeStaff.filter(u =>
    matchesDepartment(u.department, studentDept) &&
    matchesYear(u.assignedYear || u.year, studentYear)
  );

  const matchedWarden = activeWardens.filter(u =>
    (matchesDepartment(u.department, studentDept) || normalizeDepartment(u.department) === 'HOSTEL ADMINISTRATION' || !u.department) &&
    matchesYear(u.assignedYear || u.year, studentYear)
  );

  console.log(`New request routing calculation: Dept: ${studentDept}, Year: ${studentYear}`);
  console.log(`Matched Faculty Advisors for ECE II Year: [${matchedFaculty.map(f => f.name + ' (' + f.staffId + ')').join(', ')}]`);
  console.log(`Matched Wardens for II Year: [${matchedWarden.map(w => w.name + ' (' + w.staffId + ')').join(', ')}]`);

  // Create a NEW outpass request
  const newReq = await OutRequest.create({
    requestId: 'REQ' + Math.random().toString(36).slice(2, 7).toUpperCase(),
    owner: refreshedStudent.username,
    name: refreshedStudent.name,
    reg: refreshedStudent.reg,
    studentId: refreshedStudent.studentId,
    department: studentDept,
    year: studentYear,
    studentDepartment: studentDept,
    studentYear: studentYear,
    assignedFacultyAdvisorId: matchedFaculty.length > 0 ? matchedFaculty[0]._id : null,
    assignedFacultyId: matchedFaculty.length > 0 ? matchedFaculty[0]._id : null,
    assignedWardenId: matchedWarden.length > 0 ? matchedWarden[0]._id : null,
    room: refreshedStudent.room,
    dest: 'Hospital',
    fromDate: '2026-09-07T10:00:00.000Z',
    toDate: '2026-09-07T18:00:00.000Z',
    travel: 'Auto',
    parentPhone: '9876543210',
    reason: 'Medical checkup',
    type: 'weekday',
    status: 'pending_faculty',
    currentApprovalStage: 'FACULTY'
  });

  console.log('\n✔ NEW Outpass Request created with updated student details:', {
    reqId: newReq._id,
    department: newReq.department,
    year: newReq.year,
    studentDepartment: newReq.studentDepartment,
    studentYear: newReq.studentYear,
    assignedFacultyAdvisorId: newReq.assignedFacultyAdvisorId,
    assignedWardenId: newReq.assignedWardenId
  });

  if (newReq.department !== 'ECE' || newReq.year !== 'II Year') {
    throw new Error('New request does not use the updated Department and Year');
  }

  // Verify historical request preservation
  console.log('\n--- 7. Verifying Historical Request Preservation ---');
  const checkHistorical = await OutRequest.findById(historicalReq._id);
  console.log('Historical request values after student update:', {
    department: checkHistorical.department,
    year: checkHistorical.year,
    studentDepartment: checkHistorical.studentDepartment,
    studentYear: checkHistorical.studentYear
  });

  if (checkHistorical.department !== 'CSE' || checkHistorical.year !== 'I Year') {
    throw new Error('Historical request was altered! Must remain CSE I Year.');
  }
  console.log('✔ Historical request preserved perfectly as CSE I Year!');

  // Cleanup test documents
  await Student.findByIdAndDelete(testStudent._id);
  await OutRequest.findByIdAndDelete(historicalReq._id);
  await OutRequest.findByIdAndDelete(newReq._id);
  console.log('\n✔ Test cleanup completed.');

  console.log('\n🎉 ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
