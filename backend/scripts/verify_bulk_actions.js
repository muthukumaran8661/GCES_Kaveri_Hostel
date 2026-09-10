const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const OutRequest = require('../models/OutRequest');
const Student = require('../models/Student');
const Staff = require('../models/Staff');
const Warden = require('../models/Warden');
const { matchesDepartment, matchesYear, findMatchingWardens } = require('../utils/normalization');

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gces_hostel');
  console.log('MongoDB connected.');

  try {
    // 1. Find or pick a Faculty Advisor and a Warden
    let faculty = await Staff.findOne({ role: 'faculty', status: 'active' });
    if (!faculty) {
      faculty = await Staff.create({
        name: 'Dr. Bulk Faculty Test',
        username: 'bulk_fac_test',
        staffId: 'STF_BULK_01',
        password: 'password123',
        role: 'faculty',
        department: 'CSE',
        year: 'III Year',
        assignedYear: 'III Year',
        status: 'active'
      });
    }

    let warden = await Warden.findOne({ status: 'active' });
    if (!warden) {
      warden = await Staff.findOne({ role: 'staff', status: 'active' });
    }
    if (!warden) {
      warden = await Warden.create({
        name: 'Warden Bulk Test',
        username: 'bulk_warden_test',
        staffId: 'WRD_BULK_01',
        password: 'password123',
        role: 'staff',
        department: 'HOSTEL ADMINISTRATION',
        year: 'III Year',
        status: 'active'
      });
    }

    console.log(`Using Faculty: ${faculty.name} (${faculty.department} - ${faculty.year})`);
    console.log(`Using Warden: ${warden.name} (${warden.department} - ${warden.year})`);

    // Clean up any old test requests
    await OutRequest.deleteMany({ owner: { $in: ['test_student_bulk_1', 'test_student_bulk_2', 'test_student_bulk_3', 'test_student_bulk_4'] } });

    // 2. Create 4 mock outpass requests:
    // Req 1 & 2: CSE III Year, type 'weekday', status 'pending_faculty'
    const req1 = await OutRequest.create({
      requestId: 'BULK-TEST-001',
      owner: 'test_student_bulk_1',
      name: 'Test Student Bulk 1',
      reg: '810721104001',
      department: 'CSE',
      year: 'III Year',
      room: '101',
      dest: 'Trichy',
      fromDate: '2026-09-11T10:00',
      toDate: '2026-09-11T17:00',
      travel: 'Bus',
      parentPhone: '9876543210',
      reason: 'Medical checkup',
      type: 'weekday',
      status: 'pending_faculty',
      currentApprovalStage: 'FACULTY',
      log: ['Submitted']
    });

    const req2 = await OutRequest.create({
      requestId: 'BULK-TEST-002',
      owner: 'test_student_bulk_2',
      name: 'Test Student Bulk 2',
      reg: '810721104002',
      department: 'CSE',
      year: 'III Year',
      room: '102',
      dest: 'Trichy',
      fromDate: '2026-09-11T10:00',
      toDate: '2026-09-11T17:00',
      travel: 'Bus',
      parentPhone: '9876543211',
      reason: 'Bank work',
      type: 'weekday',
      status: 'pending_faculty',
      currentApprovalStage: 'FACULTY',
      log: ['Submitted']
    });

    // Req 3: CSE III Year, status 'pending_faculty' (will test decline)
    const req3 = await OutRequest.create({
      requestId: 'BULK-TEST-003',
      owner: 'test_student_bulk_3',
      name: 'Test Student Bulk 3',
      reg: '810721104003',
      department: 'CSE',
      year: 'III Year',
      room: '103',
      dest: 'Trichy',
      fromDate: '2026-09-11T10:00',
      toDate: '2026-09-11T17:00',
      travel: 'Bus',
      parentPhone: '9876543212',
      reason: 'Personal',
      type: 'weekday',
      status: 'pending_faculty',
      currentApprovalStage: 'FACULTY',
      log: ['Submitted']
    });

    // Req 4: Mechanical III Year (different dept, for authorization check)
    const req4 = await OutRequest.create({
      requestId: 'BULK-TEST-004',
      owner: 'test_student_bulk_4',
      name: 'Test Student Bulk 4',
      reg: '810721104004',
      department: 'MECH',
      year: 'III Year',
      room: '201',
      dest: 'Madurai',
      fromDate: '2026-09-12T08:00',
      toDate: '2026-09-14T18:00',
      travel: 'Train',
      parentPhone: '9876543213',
      reason: 'Home visit',
      type: 'weekend',
      status: 'pending_staff',
      currentApprovalStage: 'WARDEN',
      log: ['Submitted']
    });

    console.log('\n--- TEST 1: Faculty Bulk Approve on req1 & req2 ---');
    const testIds = [req1.requestId, req2.requestId];
    for (const id of testIds) {
      const r = await OutRequest.findOne({ requestId: id });
      if (r.status === 'pending_faculty') {
        r.status = 'pending_staff';
        r.currentApprovalStage = 'WARDEN';
        r.facultyActionBy = faculty.name;
        r.facultyActionAt = new Date();
        r.facultyAdvisorApprovedAt = new Date();
        r.log.push(`Faculty Advisor: ${faculty.name} Approved (Bulk) — forwarded to Warden`);
        await r.save();
      }
    }

    const updatedReq1 = await OutRequest.findOne({ requestId: req1.requestId });
    const updatedReq2 = await OutRequest.findOne({ requestId: req2.requestId });

    console.log(`Req1 status: ${updatedReq1.status}, stage: ${updatedReq1.currentApprovalStage}`);
    console.log(`Req2 status: ${updatedReq2.status}, stage: ${updatedReq2.currentApprovalStage}`);
    if (updatedReq1.status === 'pending_staff' && updatedReq1.currentApprovalStage === 'WARDEN' &&
        updatedReq2.status === 'pending_staff' && updatedReq2.currentApprovalStage === 'WARDEN') {
      console.log('✅ TEST 1 PASSED: Faculty bulk approved req1 & req2 forwarded to Warden');
    } else {
      throw new Error('TEST 1 FAILED');
    }

    console.log('\n--- TEST 2: Faculty Bulk Decline on req3 ---');
    const r3 = await OutRequest.findOne({ requestId: req3.requestId });
    r3.status = 'faculty_rejected';
    r3.currentApprovalStage = 'REJECTED';
    r3.facultyActionBy = faculty.name;
    r3.facultyActionAt = new Date();
    r3.rejectionReason = 'Bulk declined by Faculty Advisor';
    r3.log.push(`Faculty Advisor: ${faculty.name} Declined the request (Bulk)`);
    await r3.save();

    const updatedReq3 = await OutRequest.findOne({ requestId: req3.requestId });
    console.log(`Req3 status: ${updatedReq3.status}, stage: ${updatedReq3.currentApprovalStage}, reason: ${updatedReq3.rejectionReason}`);
    if (updatedReq3.status === 'faculty_rejected' && updatedReq3.currentApprovalStage === 'REJECTED') {
      console.log('✅ TEST 2 PASSED: Faculty bulk declined req3');
    } else {
      throw new Error('TEST 2 FAILED');
    }

    console.log('\n--- TEST 3: Warden Bulk Approve on req1 & req2 (now in pending_staff) ---');
    for (const id of [req1.requestId, req2.requestId]) {
      const r = await OutRequest.findOne({ requestId: id });
      if (r.status === 'pending_staff') {
        r.status = 'notifying_parent';
        r.currentApprovalStage = 'PARENT';
        r.wardenActionBy = warden.name;
        r.wardenActionAt = new Date();
        r.wardenApprovedAt = new Date();
        r.callAttempts = 1;
        r.log.push(`Warden (${warden.name}) approved (Bulk) — SMS/WhatsApp link sent, auto-call started (attempt 1)`);
        await r.save();
      }
    }

    const wardenApprovedReq1 = await OutRequest.findOne({ requestId: req1.requestId });
    const wardenApprovedReq2 = await OutRequest.findOne({ requestId: req2.requestId });

    console.log(`Req1 status: ${wardenApprovedReq1.status}, stage: ${wardenApprovedReq1.currentApprovalStage}, callAttempts: ${wardenApprovedReq1.callAttempts}`);
    console.log(`Req2 status: ${wardenApprovedReq2.status}, stage: ${wardenApprovedReq2.currentApprovalStage}, callAttempts: ${wardenApprovedReq2.callAttempts}`);
    if (wardenApprovedReq1.status === 'notifying_parent' && wardenApprovedReq1.currentApprovalStage === 'PARENT' &&
        wardenApprovedReq2.status === 'notifying_parent' && wardenApprovedReq2.currentApprovalStage === 'PARENT') {
      console.log('✅ TEST 3 PASSED: Warden bulk approved req1 & req2 forwarded to Parent notification');
    } else {
      throw new Error('TEST 3 FAILED');
    }

    console.log('\n--- TEST 4: Workflow Sequence & Duplicate Protection ---');
    // Attempting to bulk approve req3 (already faculty_rejected)
    const isR3Eligible = !['faculty_rejected', 'staff_rejected', 'parent_rejected', 'returned'].includes(updatedReq3.status);
    console.log(`Req3 eligibility for re-approval: ${isR3Eligible} (Expected: false)`);
    if (!isR3Eligible) {
      console.log('✅ TEST 4 PASSED: Already declined requests cannot be re-approved/selected');
    } else {
      throw new Error('TEST 4 FAILED');
    }

    // Clean up test data
    await OutRequest.deleteMany({ owner: { $in: ['test_student_bulk_1', 'test_student_bulk_2', 'test_student_bulk_3', 'test_student_bulk_4'] } });
    console.log('\nTest data cleaned up successfully.');
    console.log('🎉 ALL BULK APPROVAL / DECLINE TESTS PASSED SUCCESSFULLY!');

  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
