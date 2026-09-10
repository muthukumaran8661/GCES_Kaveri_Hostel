const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');
const connectDB = require('../config/db');
const Staff = require('../models/Staff');
const Student = require('../models/Student');
const Warden = require('../models/Warden');

async function testEndpoints() {
  console.log('--- TESTING AUTOMATIC STUDENT LIST IN FACULTY CONTROL ---');
  await connectDB();

  const app = express();
  app.use(express.json());
  app.use('/api/faculty', require('../routes/facultyRoutes'));

  // Faculty Advisor for CSE III Year (e.g. SARANYA P)
  const faculty = await Staff.findOne({ department: 'CSE', assignedYear: 'III Year', status: 'active' });
  if (!faculty) throw new Error('No active CSE III Year Faculty Advisor found.');

  // Count total CSE III Year students currently in DB
  const { matchesDepartment, matchesYear } = require('../utils/normalization');
  const allStudents = await Student.find().lean();
  const cse3Students = allStudents.filter(s =>
    matchesDepartment(faculty.department, s.department) && matchesYear(faculty.assignedYear, s.year)
  );

  console.log(`[DB INFO] Total CSE III Year students in DB: ${cse3Students.length}`);

  const JWT_SECRET = process.env.JWT_SECRET || 'gces_kaveri_hostel_secret_key_2026_super_secure';
  const facultyToken = jwt.sign({ id: faculty._id, role: 'faculty' }, JWT_SECRET, { expiresIn: '1h' });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/faculty`;

  try {
    // 1. Fetch faculty students
    const res = await fetch(`${baseUrl}/students`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    const data = await res.json();
    console.log(`[TEST 1] GET /api/faculty/students: Status ${res.status}`);
    console.log(`[TEST 1] Total Assigned: ${data.totalAssigned}, Total Unassigned: ${data.totalUnassigned}`);

    if (data.totalAssigned === 0) {
      throw new Error('FAIL: Faculty Control showed 0 students. Expected all matching CSE III Year students to appear automatically!');
    }
    console.log(`[PASS] Automatically showed ${data.totalAssigned} CSE III Year students in Faculty Advisor list without requiring manual assignment!`);

    // Pick one student from the assigned list to test removal and re-association
    const testStudent = data.assignedStudents[0];
    console.log(`[TEST 2] Testing remove student association on: ${testStudent.name} (${testStudent.registerNumber || testStudent.reg})`);

    // 2. Unassign student
    const unassignRes = await fetch(`${baseUrl}/students/${testStudent._id}/unassign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    const unassignData = await unassignRes.json();
    console.log(`[TEST 2] Unassign response: Status ${unassignRes.status}, Message: "${unassignData.message}"`);
    if (unassignRes.status !== 200 || !unassignData.success) {
      throw new Error('FAIL: Unassign request failed');
    }

    // 3. Verify student moved to unassigned
    const resAfterRemove = await fetch(`${baseUrl}/students`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    const dataAfterRemove = await resAfterRemove.json();
    console.log(`[TEST 3] After removal: Total Assigned: ${dataAfterRemove.totalAssigned}, Total Unassigned: ${dataAfterRemove.totalUnassigned}`);
    const foundInAssigned = dataAfterRemove.assignedStudents.some(s => s._id.toString() === testStudent._id.toString());
    const foundInUnassigned = dataAfterRemove.unassignedStudents.some(s => s._id.toString() === testStudent._id.toString());

    if (foundInAssigned || !foundInUnassigned) {
      throw new Error('FAIL: Student did not move to unassigned list after removal.');
    }
    console.log(`[PASS] Student ${testStudent.name} successfully removed from assigned list and moved to available/unassigned list.`);

    // 4. Verify student record STILL EXISTS in DB (account not deleted)
    const dbStudent = await Student.findById(testStudent._id);
    if (!dbStudent || !dbStudent.name) {
      throw new Error('FAIL: Student account was deleted or corrupted!');
    }
    console.log(`[PASS] Student record verified intact in database: Name="${dbStudent.name}", Dept="${dbStudent.department}", Year="${dbStudent.year}"`);

    // 5. Re-assign student
    const reassignRes = await fetch(`${baseUrl}/students/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`
      },
      body: JSON.stringify({ studentId: testStudent._id })
    });
    const reassignData = await reassignRes.json();
    console.log(`[TEST 5] Re-assign response: Status ${reassignRes.status}, Message: "${reassignData.message}"`);
    if (reassignRes.status !== 200 || !reassignData.success) {
      throw new Error('FAIL: Re-assign request failed');
    }

    // 6. Verify student moved back to assigned
    const resAfterReassign = await fetch(`${baseUrl}/students`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    const dataAfterReassign = await resAfterReassign.json();
    console.log(`[TEST 6] After re-assignment: Total Assigned: ${dataAfterReassign.totalAssigned}, Total Unassigned: ${dataAfterReassign.totalUnassigned}`);
    const backInAssigned = dataAfterReassign.assignedStudents.some(s => s._id.toString() === testStudent._id.toString());
    if (!backInAssigned) {
      throw new Error('FAIL: Student was not restored to assigned list.');
    }
    console.log(`[PASS] Student ${testStudent.name} successfully restored to Faculty Advisor student list.`);

    console.log('--- ALL AUTOMATIC FACULTY CONTROL TESTS PASSED! ---');
  } finally {
    server.close();
    process.exit(0);
  }
}

testEndpoints().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
