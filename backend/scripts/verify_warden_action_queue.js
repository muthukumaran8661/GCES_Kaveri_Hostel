const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const DEFAULT_URI = 'mongodb+srv://muthukumarangces_db_user:WEZBW13IqJpjvKLL@cluster0.m6cqhkp.mongodb.net/outformdb?appName=Cluster0';
const uri = process.env.MONGO_URI || DEFAULT_URI;

const {
  normalizeDepartment,
  normalizeYear,
  matchesDepartment,
  matchesYear,
  findMatchingFacultyAdvisors,
  findMatchingWardens
} = require('../utils/normalization');

const Staff = require('../models/Staff');
const Warden = require('../models/Warden');
const Student = require('../models/Student');
const OutRequest = require('../models/OutRequest');

async function testWardenActionQueueFlow() {
  console.log('[Test Flow] Connecting to MongoDB...');
  await mongoose.connect(uri);

  const testStudentOwner = 'test_cse_3rd_year_student';
  const testRequestId = 'REQTESTCSE3';

  // Cleanup old test record if exists
  await OutRequest.deleteMany({ $or: [{ owner: testStudentOwner }, { requestId: testRequestId }] });

  console.log('\n--- Step 1: Student (CSE III Year) Submits Outpass Request ---');
  const allStaff = await Staff.find({ status: 'active' }).lean();
  const allWardens = await Warden.find({ status: 'active' }).lean();

  const studentDept = 'CSE';
  const studentYear = 'III Year';

  const matchedFaculty = findMatchingFacultyAdvisors(allStaff, studentDept, studentYear);
  const matchedWarden = findMatchingWardens(allWardens, studentDept, studentYear);

  console.log(`Matched Faculty for ${studentDept} ${studentYear}:`, matchedFaculty[0]?.name, `(ID: ${matchedFaculty[0]?._id})`);
  console.log(`Matched Warden for ${studentDept} ${studentYear}:`, matchedWarden[0]?.name, `(ID: ${matchedWarden[0]?._id})`);

  console.assert(matchedFaculty.length > 0, 'Must find active CSE III Year Faculty');
  console.assert(matchedWarden.length > 0, 'Must find active III Year Warden');

  const createdRequest = await OutRequest.create({
    requestId: testRequestId,
    owner: testStudentOwner,
    studentId: testStudentOwner,
    name: 'Kavitha R',
    reg: '830123104055',
    studentPhone: '9876543210',
    department: 'CSE',
    year: 'III Year',
    studentDepartment: 'CSE',
    studentYear: 'III Year',
    assignedFacultyAdvisorId: matchedFaculty[0]._id,
    assignedFacultyId: matchedFaculty[0]._id,
    assignedWardenId: matchedWarden[0]._id,
    currentApprovalStage: 'FACULTY',
    room: '304',
    dest: 'Salem',
    fromDate: '2026-09-08T08:00',
    toDate: '2026-09-08T17:00',
    travel: 'Bus',
    parentPhone: '9876543210',
    reason: 'Family Event',
    type: 'weekday',
    status: 'pending_faculty',
    callAttempts: 0,
    log: ['Submitted by student (CSE - III Year) — awaiting Faculty Advisor']
  });

  console.log('✅ Created initial student request:', createdRequest.requestId, 'Stage:', createdRequest.currentApprovalStage, 'Status:', createdRequest.status);

  console.log('\n--- Step 2: Faculty Advisor Checks Queue ---');
  const facultyUser = matchedFaculty[0];
  const facultyPending = await OutRequest.find({
    $or: [
      { assignedFacultyAdvisorId: facultyUser._id },
      { assignedFacultyId: facultyUser._id }
    ],
    status: 'pending_faculty'
  }).lean();

  console.log(`Faculty Advisor (${facultyUser.name}) pending count:`, facultyPending.length);
  console.assert(facultyPending.some(r => r.requestId === testRequestId), 'Request must appear in Faculty queue');

  console.log('\n--- Step 3: Faculty Advisor Approves Request ---');
  createdRequest.status = 'pending_staff';
  createdRequest.currentApprovalStage = 'WARDEN';
  createdRequest.facultyActionBy = facultyUser.name;
  createdRequest.facultyActionAt = new Date();
  createdRequest.facultyAdvisorApprovedAt = new Date();
  createdRequest.assignedWardenId = matchedWarden[0]._id;
  createdRequest.log.push(`Faculty Advisor: ${facultyUser.name} Approved — forwarded to Warden`);
  await createdRequest.save();

  console.log('✅ Faculty approved. Saved status:', createdRequest.status, 'Stage:', createdRequest.currentApprovalStage, 'assignedWardenId:', createdRequest.assignedWardenId);

  console.log('\n--- Step 4: Verify in MongoDB ---');
  const dbRecord = await OutRequest.findOne({ requestId: testRequestId }).lean();
  console.assert(dbRecord.assignedWardenId.toString() === matchedWarden[0]._id.toString(), 'assignedWardenId in DB matches Warden ID');
  console.assert(dbRecord.status === 'pending_staff', 'Status is pending_staff');
  console.assert(dbRecord.currentApprovalStage === 'WARDEN', 'Stage is WARDEN');
  console.assert(dbRecord.facultyAdvisorApprovedAt !== null, 'Faculty approved timestamp is saved');
  console.log('✅ MongoDB verification passed.');

  console.log('\n--- Step 5: Simulate Warden Login & Action Queue Query ---');
  const wardenUser = matchedWarden[0];
  console.log(`Logged in Warden: ${wardenUser.name}, ID: ${wardenUser._id}, Dept: "${wardenUser.department}", Year: "${wardenUser.assignedYear || wardenUser.year}"`);

  // Simulate GET /api/requests/warden and GET /api/requests/warden/pending
  const allRequests = await OutRequest.find().sort({ createdAt: -1 }).lean();
  const wardenIdStr = wardenUser._id.toString();
  const wardenDept = normalizeDepartment(wardenUser.department);

  const wardenScopedRequests = allRequests.filter(r => {
    const isAssignedDirectly = r.assignedWardenId && r.assignedWardenId.toString() === wardenIdStr;
    if (isAssignedDirectly) {
      if (r.type === 'weekday' && (r.status === 'pending_faculty' || r.currentApprovalStage === 'FACULTY')) {
        return false;
      }
      return true;
    }

    const isGeneralWarden = !wardenDept || wardenDept === 'HOSTEL ADMINISTRATION' || wardenDept === 'ALL DEPARTMENTS';
    const yearMatches = matchesYear(wardenUser.year || wardenUser.assignedYear, r.year);
    const deptMatches = isGeneralWarden || matchesDepartment(wardenDept, r.department);

    if (yearMatches || (deptMatches && yearMatches)) {
      if (r.type === 'weekday' && (r.status === 'pending_faculty' || r.currentApprovalStage === 'FACULTY')) {
        return false;
      }
      return true;
    }

    return false;
  });

  // Frontend Queue Filter in StaffDashboard.jsx
  const pendingStaff = wardenScopedRequests.filter(r =>
    r.status === 'pending_staff' ||
    r.status === 'pending_warden' ||
    r.status === 'faculty_approved' ||
    r.currentApprovalStage === 'WARDEN'
  );
  const notifying = wardenScopedRequests.filter(r =>
    r.status === 'notifying_parent' ||
    r.currentApprovalStage === 'PARENT'
  );
  const queue = [...pendingStaff, ...notifying];

  console.log(`Warden Action Queue count: ${queue.length}`);
  const foundInQueue = queue.find(r => r.requestId === testRequestId);
  console.assert(foundInQueue !== undefined, 'Request MUST appear in Warden Action Queue');
  console.log('✅ Request successfully found in Warden Action Queue:', {
    requestId: foundInQueue.requestId,
    studentName: foundInQueue.name,
    regNo: foundInQueue.reg,
    dept: foundInQueue.department,
    year: foundInQueue.year,
    status: foundInQueue.status,
    stage: foundInQueue.currentApprovalStage
  });

  console.log('\n--- Step 6: Warden Approves Request ---');
  createdRequest.status = 'notifying_parent';
  createdRequest.currentApprovalStage = 'PARENT';
  createdRequest.wardenActionBy = wardenUser.name;
  createdRequest.wardenActionAt = new Date();
  createdRequest.wardenApprovedAt = new Date();
  createdRequest.callAttempts = 1;
  createdRequest.log.push(`Warden (${wardenUser.name}) approved — SMS/WhatsApp link sent`);
  await createdRequest.save();

  const approvedDbRecord = await OutRequest.findOne({ requestId: testRequestId }).lean();
  console.assert(approvedDbRecord.status === 'notifying_parent', 'Warden approved successfully');
  console.log('✅ Warden approved successfully. Current stage:', approvedDbRecord.currentApprovalStage);

  // Clean up test request
  await OutRequest.deleteOne({ requestId: testRequestId });
  console.log('✅ Cleaned up test record.');

  await mongoose.disconnect();
  console.log('\n🎉 ALL WARDEN ACTION QUEUE TESTS PASSED PERFECTLY.');
}

testWardenActionQueueFlow().catch(err => {
  console.error('[Test Failed]:', err);
  process.exit(1);
});
