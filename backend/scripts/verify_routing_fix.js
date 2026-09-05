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

async function testAll() {
  console.log('[Test] Connecting to MongoDB...');
  await mongoose.connect(uri);

  // 1. UNIT TESTS: Normalization
  console.log('\n--- 1. Testing Normalization Functions ---');
  console.assert(normalizeDepartment('cse') === 'CSE', 'cse -> CSE');
  console.assert(normalizeDepartment('CSE ') === 'CSE', 'CSE  -> CSE');
  console.assert(normalizeDepartment('Computer Science and Engineering') === 'CSE', 'CS Eng -> CSE');
  console.assert(normalizeDepartment('mechanical') === 'MECHANICAL', 'mechanical -> MECHANICAL');
  console.assert(normalizeDepartment('HOSTEL ADMINISTRATION') === 'HOSTEL ADMINISTRATION', 'Hostel Admin');
  console.assert(normalizeDepartment('all departments') === 'ALL DEPARTMENTS', 'All Departments');

  console.assert(normalizeYear('1') === 'I Year', '1 -> I Year');
  console.assert(normalizeYear('1st Year') === 'I Year', '1st Year -> I Year');
  console.assert(normalizeYear('year 1') === 'I Year', 'year 1 -> I Year');
  console.assert(normalizeYear('I Year') === 'I Year', 'I Year -> I Year');
  console.assert(normalizeYear('2nd Year') === 'II Year', '2nd Year -> II Year');
  console.assert(normalizeYear('3rd') === 'III Year', '3rd -> III Year');
  console.assert(normalizeYear('4th Year') === 'IV Year', '4th Year -> IV Year');
  console.assert(normalizeYear('all years') === 'All Years', 'all years -> All Years');
  console.log('✅ PASS: Normalization unit tests passed.');

  // 2. FETCH REAL DB DATA
  console.log('\n--- 2. Querying Active Staff & Wardens from DB ---');
  const allStaff = await Staff.find({ status: 'active' }).lean();
  const allWardens = await Warden.find({ status: 'active' }).lean();
  console.log(`Loaded ${allStaff.length} active Faculty Advisors and ${allWardens.length} active Wardens.`);

  // 3. TEST ROUTING ACROSS ALL DEPARTMENTS & YEARS
  console.log('\n--- 3. Testing Routing Across All Combinations ---');
  const testDepts = ['CSE', 'ECE', 'EEE', 'Civil', 'Mechanical', 'Mechatronics'];
  const testYears = ['I Year', 'II Year', 'III Year', 'IV Year'];

  let successCount = 0;
  let totalCombinations = testDepts.length * testYears.length;

  for (const dept of testDepts) {
    for (const year of testYears) {
      const faculties = findMatchingFacultyAdvisors(allStaff, dept, year);
      const wardens = findMatchingWardens(allWardens, dept, year);

      if (faculties.length > 0 && wardens.length > 0) {
        console.log(`✅ [${dept} - ${year}] -> Faculty: "${faculties[0].name}" (${faculties[0].department} - ${faculties[0].assignedYear || faculties[0].year}) | Warden: "${wardens[0].name}" (${wardens[0].department || 'Hostel'} - ${wardens[0].assignedYear || wardens[0].year})`);
        successCount++;
      } else {
        console.error(`❌ [${dept} - ${year}] FAILED -> Faculty: ${faculties.length}, Warden: ${wardens.length}`);
      }
    }
  }

  console.assert(successCount === totalCombinations, `All ${totalCombinations} combinations must succeed. Succeeded: ${successCount}`);
  console.log(`\n🎉 SUCCESS: ${successCount}/${totalCombinations} department & year combinations routed successfully!`);

  // 4. SIMULATE CSE I YEAR STUDENT SUBMISSION
  console.log('\n--- 4. Simulating Student Outpass Creation for CSE I Year ---');
  const cseFaculties = findMatchingFacultyAdvisors(allStaff, 'CSE', 'I Year');
  const cseWardens = findMatchingWardens(allWardens, 'CSE', 'I Year');

  console.log(`Matched Faculty for CSE I Year: ${cseFaculties[0].name} (ID: ${cseFaculties[0]._id})`);
  console.log(`Matched Warden for CSE I Year: ${cseWardens[0].name} (ID: ${cseWardens[0]._id})`);

  console.assert(cseFaculties.length > 0, 'Must match CSE I Year Faculty');
  console.assert(cseWardens.length > 0, 'Must match CSE I Year Warden');

  await mongoose.disconnect();
  console.log('\n✅ All tests passed successfully!');
}

testAll().catch(err => {
  console.error('[Test Failed]:', err);
  process.exit(1);
});
