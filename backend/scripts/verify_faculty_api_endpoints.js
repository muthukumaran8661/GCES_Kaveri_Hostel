const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');
const connectDB = require('../config/db');
const Staff = require('../models/Staff');
const Student = require('../models/Student');
const Warden = require('../models/Warden');

async function testEndpoints() {
  console.log('--- TESTING FACULTY API ENDPOINTS VIA HTTP ---');
  await connectDB();

  const app = express();
  app.use(express.json());
  app.use('/api/faculty', require('../routes/facultyRoutes'));

  const faculty = await Staff.findOne({ department: 'CSE', assignedYear: 'III Year', status: 'active' });
  const warden = await Warden.findOne({ status: 'active' });
  const student = await Student.findOne({ department: 'CSE', year: 'III Year' });
  const otherStudent = await Student.findOne({ department: 'ECE', year: 'I Year' });

  const JWT_SECRET = process.env.JWT_SECRET || 'gces_kaveri_hostel_secret_key_2026_super_secure';

  const facultyToken = jwt.sign({ id: faculty._id, role: 'faculty' }, JWT_SECRET, { expiresIn: '1h' });
  const wardenToken = jwt.sign({ id: warden._id, role: 'staff' }, JWT_SECRET, { expiresIn: '1h' });
  const studentToken = jwt.sign({ id: student._id, role: 'student' }, JWT_SECRET, { expiresIn: '1h' });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/faculty`;

  try {
    // 1. Unauthenticated request -> 401
    const res1 = await fetch(`${baseUrl}/students`);
    console.log(`[TEST 1] No token -> Status: ${res1.status} (Expected 401)`);
    if (res1.status !== 401) throw new Error('Expected 401 for unauthenticated request');

    // 2. Warden token -> 403 (Only Faculty Advisor)
    const res2 = await fetch(`${baseUrl}/students`, {
      headers: { Authorization: `Bearer ${wardenToken}` }
    });
    console.log(`[TEST 2] Warden token -> Status: ${res2.status} (Expected 403)`);
    if (res2.status !== 403) throw new Error('Expected 403 for Warden token');

    // 3. Student token -> 403
    const res3 = await fetch(`${baseUrl}/students`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    console.log(`[TEST 3] Student token -> Status: ${res3.status} (Expected 403)`);
    if (res3.status !== 403) throw new Error('Expected 403 for Student token');

    // 4. Faculty token -> 200
    const res4 = await fetch(`${baseUrl}/students`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    const data4 = await res4.json();
    console.log(`[TEST 4] Faculty token -> Status: ${res4.status} (Expected 200), Total Assigned: ${data4.totalAssigned}, Unassigned: ${data4.totalUnassigned}`);
    if (res4.status !== 200 || !data4.success) throw new Error('Expected 200 for Faculty token');

    // 5. Attempting to assign student from ANOTHER department (ECE) -> 403 Forbidden
    const res5 = await fetch(`${baseUrl}/students/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`
      },
      body: JSON.stringify({ studentId: otherStudent._id })
    });
    const data5 = await res5.json();
    console.log(`[TEST 5] Assign other department student -> Status: ${res5.status} (Expected 403), Message: "${data5.message}"`);
    if (res5.status !== 403) throw new Error('Expected 403 for different department assignment');

    // 6. Assign matching student -> 200
    const res6 = await fetch(`${baseUrl}/students/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`
      },
      body: JSON.stringify({ studentId: student._id })
    });
    const data6 = await res6.json();
    console.log(`[TEST 6] Assign matching student -> Status: ${res6.status} (Expected 200), Message: "${data6.message}"`);
    if (res6.status !== 200 || !data6.success) throw new Error('Expected 200 for matching student assignment');

    // 7. Unassign matching student -> 200
    const res7 = await fetch(`${baseUrl}/students/${student._id}/unassign`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${facultyToken}`
      }
    });
    const data7 = await res7.json();
    console.log(`[TEST 7] Unassign matching student -> Status: ${res7.status} (Expected 200), Message: "${data7.message}"`);
    if (res7.status !== 200 || !data7.success) throw new Error('Expected 200 for unassign');

    // Verify student still exists in DB
    const studentCheck = await Student.findById(student._id);
    if (!studentCheck) throw new Error('Student was deleted during unassign! Expected non-destructive removal.');
    console.log(`[TEST 8] Student record verified in database: ${studentCheck.name} still exists with assignedFacultyAdvisorId = ${studentCheck.assignedFacultyAdvisorId}`);

    console.log('--- ALL FACULTY ENDPOINT TESTS PASSED SUCCESSFULLY! ---');
  } finally {
    server.close();
    process.exit(0);
  }
}

testEndpoints().catch(err => {
  console.error('ENDPOINT TEST ERROR:', err);
  process.exit(1);
});
