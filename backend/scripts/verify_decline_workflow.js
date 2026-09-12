const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');
const http = require('http');
const express = require('express');

dotenv.config({ path: path.join(__dirname, '../.env') });

const requestRoutes = require('../routes/requestRoutes');
const OutRequest = require('../models/OutRequest');
const Staff = require('../models/Staff');
const Warden = require('../models/Warden');

async function makeRequest(port, method, endpoint, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: endpoint,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...headers
        }
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => (resBody += chunk));
        res.on('end', () => {
          let parsed = resBody;
          try {
            parsed = JSON.parse(resBody);
          } catch (_) {}
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('--- Connecting to MongoDB ---');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gces_hostel');
  console.log('MongoDB connected.');

  // Set up test Express server
  const app = express();
  app.use(express.json());
  app.use('/api/requests', requestRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  console.log(`Test Express server running on port ${port}`);

  try {
    // 1. Get or create test Faculty and Warden
    let faculty = await Staff.findOne({ role: 'faculty', status: 'active', department: 'CSE' });
    if (!faculty) {
      faculty = await Staff.create({
        name: 'Dr. Verify Decline Faculty',
        username: 'verify_fac_decline',
        staffId: 'VFD001',
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
      warden = await Warden.create({
        name: 'Verify Decline Warden',
        username: 'verify_wrd_decline',
        staffId: 'VWD001',
        password: 'password123',
        role: 'staff',
        department: 'HOSTEL ADMINISTRATION',
        year: 'III Year',
        status: 'active'
      });
    }

    const jwtSecret = process.env.JWT_SECRET || 'gces_kaveri_hostel_secret_jwt_key_2026';
    const facultyToken = jwt.sign(
      { id: faculty._id, username: faculty.username, role: 'faculty', department: faculty.department, year: faculty.year || faculty.assignedYear },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const wardenToken = jwt.sign(
      { id: warden._id, username: warden.username, role: 'staff', department: warden.department, year: warden.year || warden.assignedYear },
      jwtSecret,
      { expiresIn: '1h' }
    );

    const facultyHeaders = { Authorization: `Bearer ${facultyToken}` };
    const wardenHeaders = { Authorization: `Bearer ${wardenToken}` };

    // Clean up past test outpass requests
    await OutRequest.deleteMany({ owner: { $regex: /^test_decline_/ } });

    console.log('\n=== TEST 1: Single Faculty Advisor Decline Reason Validation ===');
    const facReq = await OutRequest.create({
      requestId: 'TEST-FAC-DECLINE-01',
      owner: 'test_decline_student_1',
      name: 'Test Decline Student 1',
      reg: '810721104991',
      department: faculty.department,
      year: faculty.year || faculty.assignedYear,
      room: '201',
      dest: 'Madurai',
      fromDate: '2026-09-15T09:00',
      toDate: '2026-09-15T17:00',
      travel: 'Bus',
      parentPhone: '9876543210',
      reason: 'Home Visit',
      type: 'weekday',
      status: 'pending_faculty',
      currentApprovalStage: 'FACULTY',
      log: ['Submitted by student']
    });

    // 1.1 Try declining without reason
    let res = await makeRequest(port, 'PATCH', `/api/requests/${facReq.requestId}/action`, facultyHeaders, {
      action: 'faculty_rejected'
    });
    console.log(`Faculty decline without reason -> HTTP ${res.status}:`, res.body);
    if (res.status !== 400 || res.body.message !== 'Please enter a reason for declining this request.') {
      throw new Error(`Expected 400 "Please enter a reason for declining this request.", got ${JSON.stringify(res.body)}`);
    }

    // 1.2 Try declining with whitespace only
    res = await makeRequest(port, 'PATCH', `/api/requests/${facReq.requestId}/action`, facultyHeaders, {
      action: 'faculty_rejected',
      reason: '    '
    });
    console.log(`Faculty decline with spaces -> HTTP ${res.status}:`, res.body);
    if (res.status !== 400 || res.body.message !== 'Please enter a reason for declining this request.') {
      throw new Error(`Expected 400 "Please enter a reason for declining this request.", got ${JSON.stringify(res.body)}`);
    }

    // 1.3 Decline with valid reason
    const facReasonText = 'Academic test scheduled tomorrow morning';
    res = await makeRequest(port, 'PATCH', `/api/requests/${facReq.requestId}/action`, facultyHeaders, {
      action: 'faculty_rejected',
      reason: `  ${facReasonText}  `
    });
    console.log(`Faculty decline with valid reason -> HTTP ${res.status}:`, res.body?.success);
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Expected 200 success, got ${JSON.stringify(res.body)}`);
    }

    const updatedFacReq = await OutRequest.findOne({ requestId: facReq.requestId });
    if (updatedFacReq.status !== 'faculty_rejected' ||
        updatedFacReq.currentApprovalStage !== 'REJECTED' ||
        updatedFacReq.rejectionReason !== facReasonText) {
      throw new Error(`Faculty decline verification in DB failed! Stored reason: "${updatedFacReq.rejectionReason}"`);
    }
    console.log(`✅ Faculty single decline successfully saved rejectionReason: "${updatedFacReq.rejectionReason}"`);

    console.log('\n=== TEST 2: Single Warden Decline Reason Validation ===');
    const wrdReq = await OutRequest.create({
      requestId: 'TEST-WRD-DECLINE-01',
      owner: 'test_decline_student_2',
      name: 'Test Decline Student 2',
      reg: '810721104992',
      department: faculty.department,
      year: faculty.year || faculty.assignedYear,
      assignedWardenId: warden._id,
      room: '202',
      dest: 'Coimbatore',
      fromDate: '2026-09-15T09:00',
      toDate: '2026-09-15T17:00',
      travel: 'Bus',
      parentPhone: '9876543210',
      reason: 'Shopping',
      type: 'weekend',
      status: 'pending_staff',
      currentApprovalStage: 'WARDEN',
      log: ['Submitted by student']
    });

    // 2.1 Warden decline without reason
    res = await makeRequest(port, 'PATCH', `/api/requests/${wrdReq.requestId}/action`, wardenHeaders, {
      action: 'staff_rejected'
    });
    console.log(`Warden decline without reason -> HTTP ${res.status}:`, res.body);
    if (res.status !== 400 || res.body.message !== 'Please enter a reason for declining this request.') {
      throw new Error(`Expected 400 "Please enter a reason for declining this request.", got ${JSON.stringify(res.body)}`);
    }

    // 2.2 Warden decline with spaces
    res = await makeRequest(port, 'PATCH', `/api/requests/${wrdReq.requestId}/action`, wardenHeaders, {
      action: 'staff_rejected',
      reason: '\t  \n '
    });
    console.log(`Warden decline with spaces -> HTTP ${res.status}:`, res.body);
    if (res.status !== 400 || res.body.message !== 'Please enter a reason for declining this request.') {
      throw new Error(`Expected 400 "Please enter a reason for declining this request.", got ${JSON.stringify(res.body)}`);
    }

    // 2.3 Warden decline with valid reason
    const wrdReasonText = 'Hostel discipline curfew violation pending enquiry';
    res = await makeRequest(port, 'PATCH', `/api/requests/${wrdReq.requestId}/action`, wardenHeaders, {
      action: 'staff_rejected',
      reason: wrdReasonText
    });
    console.log(`Warden decline with valid reason -> HTTP ${res.status}:`, res.body?.success);
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Expected 200 success, got ${JSON.stringify(res.body)}`);
    }

    const updatedWrdReq = await OutRequest.findOne({ requestId: wrdReq.requestId });
    if (updatedWrdReq.status !== 'staff_rejected' ||
        updatedWrdReq.currentApprovalStage !== 'REJECTED' ||
        updatedWrdReq.rejectionReason !== wrdReasonText) {
      throw new Error(`Warden decline verification in DB failed! Stored reason: "${updatedWrdReq.rejectionReason}"`);
    }
    console.log(`✅ Warden single decline successfully saved rejectionReason: "${updatedWrdReq.rejectionReason}"`);

    console.log('\n=== TEST 3: Parent Decline Does Not Require Reason ===');
    const parentReq = await OutRequest.create({
      requestId: 'TEST-PARENT-DECLINE-01',
      owner: 'test_decline_student_3',
      name: 'Test Decline Student 3',
      reg: '810721104993',
      department: faculty.department,
      year: faculty.year || faculty.assignedYear,
      assignedWardenId: warden._id,
      room: '203',
      dest: 'Chennai',
      fromDate: '2026-09-15T09:00',
      toDate: '2026-09-15T17:00',
      travel: 'Train',
      parentPhone: '9876543210',
      reason: 'Festival',
      type: 'weekend',
      status: 'notifying_parent',
      currentApprovalStage: 'PARENT',
      log: ['Warden approved']
    });

    res = await makeRequest(port, 'PATCH', `/api/requests/${parentReq.requestId}/action`, wardenHeaders, {
      action: 'parent_rejected'
    });
    console.log(`Parent decline without reason -> HTTP ${res.status}:`, res.body?.success);
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Expected 200 for parent_rejected without reason, got ${JSON.stringify(res.body)}`);
    }

    const updatedParentReq = await OutRequest.findOne({ requestId: parentReq.requestId });
    if (updatedParentReq.status !== 'parent_rejected' || updatedParentReq.currentApprovalStage !== 'REJECTED') {
      throw new Error(`Parent decline status check failed!`);
    }
    console.log(`✅ Parent decline succeeded without requiring a reason, reason saved: "${updatedParentReq.rejectionReason}"`);

    console.log('\n=== TEST 4: Bulk Decline Reason Validation & Execution ===');
    const bulk1 = await OutRequest.create({
      requestId: 'TEST-BULK-01',
      owner: 'test_decline_bulk_1',
      name: 'Bulk Student 1',
      reg: '810721104994',
      department: faculty.department,
      year: faculty.year || faculty.assignedYear,
      room: '301',
      dest: 'Tanjore',
      fromDate: '2026-09-15T09:00',
      toDate: '2026-09-15T17:00',
      travel: 'Bus',
      parentPhone: '9876543210',
      reason: 'Visit',
      type: 'weekday',
      status: 'pending_faculty',
      currentApprovalStage: 'FACULTY',
      log: ['Submitted']
    });

    const bulk2 = await OutRequest.create({
      requestId: 'TEST-BULK-02',
      owner: 'test_decline_bulk_2',
      name: 'Bulk Student 2',
      reg: '810721104995',
      department: faculty.department,
      year: faculty.year || faculty.assignedYear,
      room: '302',
      dest: 'Karur',
      fromDate: '2026-09-15T09:00',
      toDate: '2026-09-15T17:00',
      travel: 'Bus',
      parentPhone: '9876543210',
      reason: 'Personal',
      type: 'weekday',
      status: 'pending_faculty',
      currentApprovalStage: 'FACULTY',
      log: ['Submitted']
    });

    // 4.1 Bulk decline without reason
    res = await makeRequest(port, 'POST', '/api/requests/bulk-action', facultyHeaders, {
      requestIds: [bulk1.requestId, bulk2.requestId],
      action: 'faculty_rejected'
    });
    console.log(`Bulk decline without reason -> HTTP ${res.status}:`, res.body);
    if (res.status !== 400 || res.body.message !== 'Please enter a reason for declining this request.') {
      throw new Error(`Expected 400 "Please enter a reason for declining this request.", got ${JSON.stringify(res.body)}`);
    }

    // 4.2 Bulk decline with spaces
    res = await makeRequest(port, 'POST', '/api/requests/bulk-action', facultyHeaders, {
      requestIds: [bulk1.requestId, bulk2.requestId],
      action: 'faculty_rejected',
      reason: '   '
    });
    console.log(`Bulk decline with spaces -> HTTP ${res.status}:`, res.body);
    if (res.status !== 400 || res.body.message !== 'Please enter a reason for declining this request.') {
      throw new Error(`Expected 400 "Please enter a reason for declining this request.", got ${JSON.stringify(res.body)}`);
    }

    // 4.3 Bulk decline with valid reason
    const bulkReason = 'Department symposium attendance is mandatory today';
    res = await makeRequest(port, 'POST', '/api/requests/bulk-action', facultyHeaders, {
      requestIds: [bulk1.requestId, bulk2.requestId],
      action: 'faculty_rejected',
      reason: bulkReason
    });
    console.log(`Bulk decline with valid reason -> HTTP ${res.status}:`, res.body?.message);
    if (res.status !== 200 || !res.body.success || res.body.processedCount !== 2) {
      throw new Error(`Expected 200 and processedCount 2, got ${JSON.stringify(res.body)}`);
    }

    const checkBulk1 = await OutRequest.findOne({ requestId: bulk1.requestId });
    const checkBulk2 = await OutRequest.findOne({ requestId: bulk2.requestId });

    if (checkBulk1.status !== 'faculty_rejected' || checkBulk1.rejectionReason !== bulkReason ||
        checkBulk2.status !== 'faculty_rejected' || checkBulk2.rejectionReason !== bulkReason) {
      throw new Error('Bulk decline did not save reason to all requests in MongoDB!');
    }
    console.log(`✅ Bulk decline successfully applied reason to both requests: "${checkBulk1.rejectionReason}"`);

    console.log('\n=== TEST 5: Complete Outpass Approval Flows ===');

    // 5.1 Weekday / Emergency Out Pass: Faculty Advisor -> Warden -> Parent
    console.log('Testing Flow 1: Weekday / Emergency Pass...');
    const weekdayPass = await OutRequest.create({
      requestId: 'TEST-FLOW-WD-01',
      owner: 'test_decline_flow_1',
      name: 'Flow Student Weekday',
      reg: '810721104996',
      department: faculty.department,
      year: faculty.year || faculty.assignedYear,
      assignedWardenId: warden._id,
      room: '101',
      dest: 'Trichy Hospital',
      fromDate: '2026-09-15T09:00',
      toDate: '2026-09-15T16:00',
      travel: 'Auto',
      parentPhone: '9876543210',
      reason: 'Medical Emergency Checkup',
      type: 'weekday',
      status: 'pending_faculty',
      currentApprovalStage: 'FACULTY',
      log: ['Submitted by student']
    });

    // Warden cannot approve weekday pass when still in FACULTY stage
    res = await makeRequest(port, 'PATCH', `/api/requests/${weekdayPass.requestId}/action`, wardenHeaders, {
      action: 'staff_approved'
    });
    if (res.status !== 403 && res.status !== 400) {
      throw new Error(`Expected Warden approval to be blocked before Faculty Advisor approval! Got status ${res.status}`);
    }
    console.log('✓ Warden correctly blocked from approving Weekday Pass before Faculty Advisor');

    // Faculty Advisor approves
    res = await makeRequest(port, 'PATCH', `/api/requests/${weekdayPass.requestId}/action`, facultyHeaders, {
      action: 'faculty_approved'
    });
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Faculty approval failed: ${JSON.stringify(res.body)}`);
    }
    let flowReq = await OutRequest.findOne({ requestId: weekdayPass.requestId });
    if (flowReq.status !== 'pending_staff' || flowReq.currentApprovalStage !== 'WARDEN') {
      throw new Error(`After Faculty approval, stage should be WARDEN! Got ${flowReq.status}, ${flowReq.currentApprovalStage}`);
    }
    console.log('✓ Faculty Advisor approved -> forwarded to Warden (status: pending_staff, stage: WARDEN)');

    // Warden approves
    res = await makeRequest(port, 'PATCH', `/api/requests/${weekdayPass.requestId}/action`, wardenHeaders, {
      action: 'staff_approved'
    });
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Warden approval failed: ${JSON.stringify(res.body)}`);
    }
    flowReq = await OutRequest.findOne({ requestId: weekdayPass.requestId });
    if (flowReq.status !== 'notifying_parent' || flowReq.currentApprovalStage !== 'PARENT') {
      throw new Error(`After Warden approval, stage should be PARENT! Got ${flowReq.status}, ${flowReq.currentApprovalStage}`);
    }
    console.log('✓ Warden approved -> forwarded to Parent (status: notifying_parent, stage: PARENT)');

    // Parent approves
    res = await makeRequest(port, 'PATCH', `/api/requests/${weekdayPass.requestId}/action`, wardenHeaders, {
      action: 'parent_approved'
    });
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Parent approval failed: ${JSON.stringify(res.body)}`);
    }
    flowReq = await OutRequest.findOne({ requestId: weekdayPass.requestId });
    if (flowReq.status !== 'approved_final' || flowReq.currentApprovalStage !== 'READY' || !flowReq.qrToken) {
      throw new Error(`After Parent approval, pass should be READY with qrToken!`);
    }
    console.log(`✓ Parent approved -> Outpass Ready with QR Token: ${flowReq.qrToken}`);

    // 5.2 Weekend Out Pass: Warden -> Parent
    console.log('\nTesting Flow 2: Weekend Pass...');
    const weekendPass = await OutRequest.create({
      requestId: 'TEST-FLOW-WE-01',
      owner: 'test_decline_flow_2',
      name: 'Flow Student Weekend',
      reg: '810721104997',
      department: faculty.department,
      year: faculty.year || faculty.assignedYear,
      assignedWardenId: warden._id,
      room: '102',
      dest: 'Home',
      fromDate: '2026-09-19T08:00',
      toDate: '2026-09-20T18:00',
      travel: 'Bus',
      parentPhone: '9876543210',
      reason: 'Weekend Home Visit',
      type: 'weekend',
      status: 'pending_staff',
      currentApprovalStage: 'WARDEN',
      log: ['Submitted by student']
    });

    // Warden approves
    res = await makeRequest(port, 'PATCH', `/api/requests/${weekendPass.requestId}/action`, wardenHeaders, {
      action: 'staff_approved'
    });
    if (res.status !== 200) throw new Error(`Weekend Warden approval failed`);
    flowReq = await OutRequest.findOne({ requestId: weekendPass.requestId });
    if (flowReq.status !== 'notifying_parent' || flowReq.currentApprovalStage !== 'PARENT') {
      throw new Error(`Weekend flow: Expected PARENT stage after warden approval`);
    }
    console.log('✓ Weekend Pass: Warden approved -> Parent notification started');

    // 5.3 Weekday / Government Holiday Out Pass: Warden -> Parent
    console.log('\nTesting Flow 3: Weekday / Government Holiday Pass...');
    const govtPass = await OutRequest.create({
      requestId: 'TEST-FLOW-GOVT-01',
      owner: 'test_decline_flow_3',
      name: 'Flow Student Govt Holiday',
      reg: '810721104998',
      department: faculty.department,
      year: faculty.year || faculty.assignedYear,
      assignedWardenId: warden._id,
      room: '103',
      dest: 'Home',
      fromDate: '2026-09-16T08:00',
      toDate: '2026-09-16T18:00',
      travel: 'Bus',
      parentPhone: '9876543210',
      reason: 'Govt Holiday Festival',
      type: 'weekday_govt',
      status: 'pending_staff',
      currentApprovalStage: 'WARDEN',
      log: ['Submitted by student']
    });

    // Warden approves
    res = await makeRequest(port, 'PATCH', `/api/requests/${govtPass.requestId}/action`, wardenHeaders, {
      action: 'staff_approved'
    });
    if (res.status !== 200) throw new Error(`Govt Holiday Warden approval failed`);
    flowReq = await OutRequest.findOne({ requestId: govtPass.requestId });
    if (flowReq.status !== 'notifying_parent' || flowReq.currentApprovalStage !== 'PARENT') {
      throw new Error(`Govt Holiday flow: Expected PARENT stage after warden approval`);
    }
    console.log('✓ Weekday / Govt Holiday Pass: Warden approved -> Parent notification started');

    console.log('\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
  } finally {
    // Clean up test records
    await OutRequest.deleteMany({ owner: { $regex: /^test_decline_/ } });
    server.close();
    await mongoose.disconnect();
    console.log('MongoDB disconnected and test server stopped.');
  }
}

run().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
