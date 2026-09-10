const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');
dotenv.config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const requestRoutes = require('../routes/requestRoutes');
const OutRequest = require('../models/OutRequest');
const Staff = require('../models/Staff');
const Warden = require('../models/Warden');

async function testHttp() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gces_hostel');

  try {
    const app = express();
    app.use(express.json());
    app.use('/api/requests', requestRoutes);

    const faculty = await Staff.findOne({ role: 'faculty', status: 'active', department: 'CSE' }) ||
      await Staff.findOne({ role: 'faculty', status: 'active' });

    const facultyToken = jwt.sign(
      { id: faculty._id, username: faculty.username, role: 'faculty' },
      process.env.JWT_SECRET || 'gces_kaveri_hostel_secret_jwt_key_2026',
      { expiresIn: '1d' }
    );

    const warden = await Warden.findOne({ status: 'active' }) ||
      await Staff.findOne({ role: 'staff', status: 'active' });

    const wardenToken = jwt.sign(
      { id: warden._id, username: warden.username, role: 'staff' },
      process.env.JWT_SECRET || 'gces_kaveri_hostel_secret_jwt_key_2026',
      { expiresIn: '1d' }
    );

    // Create 2 test requests
    const r1 = await OutRequest.create({
      requestId: 'HTTP-TEST-01',
      owner: 'http_student_1',
      name: 'HTTP Student 1',
      reg: '810721104101',
      department: faculty.department,
      year: faculty.year || faculty.assignedYear,
      room: '101',
      dest: 'Salem',
      fromDate: '2026-09-11T10:00',
      toDate: '2026-09-11T17:00',
      travel: 'Bus',
      parentPhone: '9876543210',
      reason: 'Home',
      type: 'weekday',
      status: 'pending_faculty',
      currentApprovalStage: 'FACULTY',
      log: ['Submitted']
    });

    const r2 = await OutRequest.create({
      requestId: 'HTTP-TEST-02',
      owner: 'http_student_2',
      name: 'HTTP Student 2',
      reg: '810721104102',
      department: faculty.department,
      year: faculty.year || faculty.assignedYear,
      room: '102',
      dest: 'Salem',
      fromDate: '2026-09-11T10:00',
      toDate: '2026-09-11T17:00',
      travel: 'Bus',
      parentPhone: '9876543211',
      reason: 'Home',
      type: 'weekday',
      status: 'pending_faculty',
      currentApprovalStage: 'FACULTY',
      log: ['Submitted']
    });

    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    console.log(`Test server running on port ${port}`);

    // 1. Test Faculty Bulk Approve via HTTP
    console.log('\n--- 1. Testing Faculty Bulk Approve HTTP ---');
    const facRes = await fetch(`${baseUrl}/api/requests/bulk-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${facultyToken}`
      },
      body: JSON.stringify({
        requestIds: [r1.requestId, r2.requestId],
        action: 'faculty_approved'
      })
    });
    const facJson = await facRes.json();
    console.log('Faculty Bulk Approve response:', facJson);
    if (!facJson.success || facJson.processedCount !== 2) {
      throw new Error('Faculty bulk approve HTTP failed');
    }

    // Verify DB
    const dbR1 = await OutRequest.findOne({ requestId: r1.requestId });
    const dbR2 = await OutRequest.findOne({ requestId: r2.requestId });
    console.log(`DB statuses after faculty approve: R1=${dbR1.status}, R2=${dbR2.status}`);
    if (dbR1.status !== 'pending_staff' || dbR2.status !== 'pending_staff') {
      throw new Error('DB status not pending_staff');
    }

    // 2. Test Warden Bulk Approve via HTTP
    console.log('\n--- 2. Testing Warden Bulk Approve HTTP ---');
    const wrdRes = await fetch(`${baseUrl}/api/requests/bulk-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${wardenToken}`
      },
      body: JSON.stringify({
        requestIds: [r1.requestId, r2.requestId],
        action: 'staff_approved'
      })
    });
    const wrdJson = await wrdRes.json();
    console.log('Warden Bulk Approve response:', wrdJson);
    if (!wrdJson.success || wrdJson.processedCount !== 2) {
      throw new Error('Warden bulk approve HTTP failed');
    }

    // Verify DB
    const dbR1W = await OutRequest.findOne({ requestId: r1.requestId });
    const dbR2W = await OutRequest.findOne({ requestId: r2.requestId });
    console.log(`DB statuses after warden approve: R1=${dbR1W.status}, R2=${dbR2W.status}`);
    if (dbR1W.status !== 'notifying_parent' || dbR2W.status !== 'notifying_parent') {
      throw new Error('DB status not notifying_parent');
    }

    // 3. Test duplicate protection: re-submitting should fail
    console.log('\n--- 3. Testing Duplicate Protection HTTP ---');
    const dupRes = await fetch(`${baseUrl}/api/requests/bulk-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${wardenToken}`
      },
      body: JSON.stringify({
        requestIds: [r1.requestId, r2.requestId],
        action: 'staff_approved'
      })
    });
    const dupJson = await dupRes.json();
    console.log('Duplicate bulk action response:', dupJson);
    if (dupJson.processedCount !== 0) {
      throw new Error('Duplicate action should have failed for already approved requests');
    }
    console.log('✅ Duplicate action prevented successfully.');

    // 4. Test Role isolation: faculty calling staff_approved -> 403
    console.log('\n--- 4. Testing Role Isolation HTTP ---');
    const isoRes = await fetch(`${baseUrl}/api/requests/bulk-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${facultyToken}`
      },
      body: JSON.stringify({
        requestIds: [r1.requestId],
        action: 'staff_approved'
      })
    });
    console.log(`Faculty calling staff_approved status: ${isoRes.status}`);
    if (isoRes.status !== 403) {
      throw new Error('Faculty should receive 403 when calling staff_approved');
    }
    console.log('✅ Role isolation verified successfully.');

    // Cleanup
    await OutRequest.deleteMany({ owner: { $in: ['http_student_1', 'http_student_2'] } });
    server.close();
    console.log('\n🎉 ALL HTTP BULK API TESTS PASSED PERFECTLY!');

  } catch (err) {
    console.error('HTTP Test error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testHttp();
