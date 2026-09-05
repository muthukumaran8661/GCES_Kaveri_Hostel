const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const DEFAULT_URI = 'mongodb+srv://muthukumarangces_db_user:WEZBW13IqJpjvKLL@cluster0.m6cqhkp.mongodb.net/outformdb?appName=Cluster0';
const uri = process.env.MONGO_URI || DEFAULT_URI;

const { normalizeDepartment, normalizeYear, matchesDepartment, matchesYear } = require('../utils/normalization');

async function inspectAssignments() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const wardens = await db.collection('wardens').find({}).toArray();
  console.log('=== WARDENS IN DB ===');
  wardens.forEach((w, i) => {
    console.log(`${i + 1}. [${w.status}] ${w.name} (${w.username}) - Dept: "${w.department}", assignedYear: "${w.assignedYear}", year: "${w.year}", role: "${w.role}"`);
  });

  const staff = await db.collection('staff').find({}).toArray();
  console.log('\n=== FACULTY ADVISORS IN DB ===');
  staff.forEach((s, i) => {
    console.log(`${i + 1}. [${s.status}] ${s.name} (${s.username}) - Dept: "${s.department}", assignedYear: "${s.assignedYear}", year: "${s.year}", role: "${s.role}"`);
  });

  console.log('\n=== TESTING ROUTING FOR CSE I YEAR ===');
  const studentDept = 'CSE';
  const studentYear = 'I Year';

  const activeStaffUsers = staff.filter(s => s.status === 'active');
  const activeWardens = wardens.filter(w => w.status === 'active');

  const matchedFaculties = activeStaffUsers.filter(u =>
    matchesDepartment(u.department, studentDept) &&
    matchesYear(u.assignedYear || u.year, studentYear)
  );

  const matchedWardens = activeWardens.filter(u =>
    (matchesDepartment(u.department, studentDept) || normalizeDepartment(u.department) === 'HOSTEL ADMINISTRATION' || normalizeDepartment(u.department) === 'ALL DEPARTMENTS' || !u.department) &&
    matchesYear(u.assignedYear || u.year, studentYear)
  );

  console.log(`Matched Faculty count: ${matchedFaculties.length}`, matchedFaculties.map(f => f.name));
  console.log(`Matched Warden count: ${matchedWardens.length}`, matchedWardens.map(w => w.name));

  await mongoose.disconnect();
}

inspectAssignments().catch(console.error);
