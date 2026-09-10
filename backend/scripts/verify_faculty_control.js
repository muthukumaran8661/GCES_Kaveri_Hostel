const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('../config/db');
const Staff = require('../models/Staff');
const Student = require('../models/Student');
const Warden = require('../models/Warden');

async function runVerification() {
  console.log('--- STARTING FACULTY CONTROL VERIFICATION ---');
  await connectDB();

  // 1. Find a Faculty Advisor (e.g. CSE III Year)
  const faculty = await Staff.findOne({ department: 'CSE', assignedYear: 'III Year', status: 'active' });
  if (!faculty) {
    throw new Error('No CSE III Year Faculty Advisor found for testing.');
  }
  console.log(`[PASS] Found Faculty Advisor: ${faculty.name} (${faculty.department} - ${faculty.assignedYear}) [ID: ${faculty._id}]`);

  // 2. Find a student in the same department and year (CSE III Year)
  let matchingStudent = await Student.findOne({ department: 'CSE', year: 'III Year' });
  if (!matchingStudent) {
    throw new Error('No CSE III Year student found for testing.');
  }
  console.log(`[PASS] Found matching student: ${matchingStudent.name} (${matchingStudent.department} - ${matchingStudent.year})`);

  // 3. Find a student in a DIFFERENT department (e.g. ECE I Year)
  let otherStudent = await Student.findOne({ department: 'ECE', year: 'I Year' });
  if (!otherStudent) {
    throw new Error('No ECE I Year student found for testing boundary checks.');
  }
  console.log(`[PASS] Found non-matching student: ${otherStudent.name} (${otherStudent.department} - ${otherStudent.year})`);

  // 4. Test Assignment logic
  matchingStudent.assignedFacultyAdvisorId = faculty._id;
  await matchingStudent.save();

  const verifyAssigned = await Student.findById(matchingStudent._id);
  if (!verifyAssigned.assignedFacultyAdvisorId || verifyAssigned.assignedFacultyAdvisorId.toString() !== faculty._id.toString()) {
    throw new Error('Failed to set assignedFacultyAdvisorId on matching student.');
  }
  console.log(`[PASS] Student ${matchingStudent.name} successfully assigned to ${faculty.name}`);

  // 5. Test Unassign logic (must not delete student!)
  verifyAssigned.assignedFacultyAdvisorId = null;
  await verifyAssigned.save();

  const verifyUnassigned = await Student.findById(matchingStudent._id);
  if (verifyUnassigned.assignedFacultyAdvisorId !== null) {
    throw new Error('Expected assignedFacultyAdvisorId to be null after unassign.');
  }
  if (!verifyUnassigned.name || !verifyUnassigned.username) {
    throw new Error('Student record was damaged during unassign.');
  }
  console.log(`[PASS] Student ${matchingStudent.name} unassigned successfully without deleting account`);

  // 6. Test normalization matching
  const { matchesDepartment, matchesYear } = require('../utils/normalization');
  console.log('[CHECK] matchesDepartment CSE and CSE:', matchesDepartment(faculty.department, matchingStudent.department));
  console.log('[CHECK] matchesYear III Year and III Year:', matchesYear(faculty.assignedYear, matchingStudent.year));
  console.log('[CHECK] matchesDepartment CSE and ECE:', matchesDepartment(faculty.department, otherStudent.department));
  console.log('[CHECK] matchesYear III Year and I Year:', matchesYear(faculty.assignedYear, otherStudent.year));

  if (!matchesDepartment(faculty.department, matchingStudent.department) || !matchesYear(faculty.assignedYear, matchingStudent.year)) {
    throw new Error('Department/Year normalization failed for matching student.');
  }
  if (matchesDepartment(faculty.department, otherStudent.department) || matchesYear(faculty.assignedYear, otherStudent.year)) {
    throw new Error('Department/Year boundary check failed for non-matching student.');
  }
  console.log('[PASS] Department and Year isolation checks passed strictly.');

  console.log('--- ALL FACULTY CONTROL CHECKS PASSED SUCCESSFULLY ---');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
