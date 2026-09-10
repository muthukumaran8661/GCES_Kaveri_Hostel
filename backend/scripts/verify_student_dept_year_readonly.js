const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');
const connectDB = require('../config/db');
const Student = require('../models/Student');

async function verifyReadOnlyDeptAndYear() {
  console.log('--- VERIFYING STUDENT DEPARTMENT & YEAR READ-ONLY STATUS ---');
  await connectDB();

  const app = express();
  app.use(express.json());
  app.use('/api/students', require('../routes/studentRoutes'));
  app.use('/api/users', require('../routes/userRoutes'));

  const student = await Student.findOne({ role: 'student' });
  if (!student) throw new Error('No student found for testing.');

  const originalDept = student.department;
  const originalYear = student.year;
  console.log(`[TEST SETUP] Testing on student: ${student.name} (${student.username}) - Current Dept: "${originalDept}", Year: "${originalYear}"`);

  const JWT_SECRET = process.env.JWT_SECRET || 'gces_kaveri_hostel_secret_key_2026_super_secure';
  const studentToken = jwt.sign({ id: student._id, role: 'student' }, JWT_SECRET, { expiresIn: '1h' });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Test PATCH /api/students/profile/department -> 403 Forbidden
    const deptRes = await fetch(`${baseUrl}/api/students/profile/department`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ department: 'Civil' })
    });
    const deptData = await deptRes.json();
    console.log(`[TEST 1] PATCH /api/students/profile/department: Status ${deptRes.status} (Expected 403), Message: "${deptData.message}"`);
    if (deptRes.status !== 403) throw new Error('Expected 403 for PATCH /profile/department');

    // 2. Test PATCH /api/students/profile/year -> 403 Forbidden
    const yearRes = await fetch(`${baseUrl}/api/students/profile/year`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ year: 'IV Year' })
    });
    const yearData = await yearRes.json();
    console.log(`[TEST 2] PATCH /api/students/profile/year: Status ${yearRes.status} (Expected 403), Message: "${yearData.message}"`);
    if (yearRes.status !== 403) throw new Error('Expected 403 for PATCH /profile/year');

    // 3. Test PUT /api/users/profile -> attempt altering department or year
    const putRes = await fetch(`${baseUrl}/api/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        department: 'Civil',
        year: 'IV Year'
      })
    });
    const putData = await putRes.json();
    console.log(`[TEST 3] PUT /api/users/profile: Status ${putRes.status}`);

    // Verify DB student department and year DID NOT CHANGE
    const refreshedStudent = await Student.findById(student._id);
    console.log(`[TEST 4] Database verification: Dept is "${refreshedStudent.department}", Year is "${refreshedStudent.year}"`);
    if (refreshedStudent.department !== originalDept || refreshedStudent.year !== originalYear) {
      throw new Error(`FAIL: Department or Year was modified! Expected ${originalDept} / ${originalYear}, got ${refreshedStudent.department} / ${refreshedStudent.year}`);
    }
    console.log('[PASS] Department and Year remained strictly unchanged in database.');

    console.log('--- ALL STUDENT DEPARTMENT & YEAR READ-ONLY CHECKS PASSED! ---');
  } finally {
    server.close();
    process.exit(0);
  }
}

verifyReadOnlyDeptAndYear().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
