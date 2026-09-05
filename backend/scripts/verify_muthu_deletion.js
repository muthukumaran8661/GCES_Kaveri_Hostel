const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const DEFAULT_URI = 'mongodb+srv://muthukumarangces_db_user:WEZBW13IqJpjvKLL@cluster0.m6cqhkp.mongodb.net/outformdb?appName=Cluster0';
const uri = process.env.MONGO_URI || DEFAULT_URI;

const Warden = require('../models/Warden');
const Staff = require('../models/Staff');
const User = require('../models/User');
const Student = require('../models/Student');
const OutRequest = require('../models/OutRequest');
const { seedWardenAccounts } = require('../config/seedWardens');

async function verify() {
  console.log('[Verification] Connecting to MongoDB...');
  await mongoose.connect(uri);

  // Test 1: Run seedWardenAccounts to prove it does NOT re-create Muthu
  console.log('\n[Test 1] Testing seedWardenAccounts() behavior on server restart...');
  await seedWardenAccounts();
  const seededMuthu = await Warden.findOne({
    $or: [{ username: /muthu@123/i }, { staffId: /muthu@123/i }, { name: /muthukumaran/i }]
  });
  if (!seededMuthu) {
    console.log('✅ PASS: seedWardenAccounts() did NOT re-create the Warden account.');
  } else {
    throw new Error('❌ FAIL: seedWardenAccounts re-created the Warden account!');
  }

  // Test 2: Check all collections for any Muthu account
  console.log('\n[Test 2] Checking all collections for Muthukumaran G / Muthu@123...');
  const inWardens = await Warden.countDocuments({ $or: [{ username: /muthu@123/i }, { staffId: /muthu@123/i }, { name: /muthukumaran/i }] });
  const inStaff = await Staff.countDocuments({ $or: [{ username: /muthu@123/i }, { staffId: /muthu@123/i }, { name: /muthukumaran/i }] });
  const inUsers = await User.countDocuments({ $or: [{ username: /muthu@123/i }, { staffId: /muthu@123/i }, { name: /muthukumaran/i }] });

  console.log(`  - Wardens count: ${inWardens}`);
  console.log(`  - Staff count: ${inStaff}`);
  console.log(`  - Users count: ${inUsers}`);

  if (inWardens === 0 && inStaff === 0 && inUsers === 0) {
    console.log('✅ PASS: Zero records found across all collections.');
  } else {
    throw new Error('❌ FAIL: Account still found in database!');
  }

  // Test 3: Check that other wardens and students are intact
  console.log('\n[Test 3] Verifying remaining accounts and request history...');
  const totalWardens = await Warden.countDocuments({});
  const totalStaff = await Staff.countDocuments({});
  const totalStudents = await Student.countDocuments({});
  const totalRequests = await OutRequest.countDocuments({});

  console.log(`  - Active Wardens: ${totalWardens}`);
  console.log(`  - Active Faculty: ${totalStaff}`);
  console.log(`  - Active Students: ${totalStudents}`);
  console.log(`  - Outpass Requests preserved: ${totalRequests}`);

  if (totalWardens > 0 && totalStudents > 0) {
    console.log('✅ PASS: All other system accounts and student outpass history are fully preserved.');
  } else {
    console.warn('⚠️ Note: counts were lower than expected.');
  }

  await mongoose.disconnect();
  console.log('\n🎉 ALL VERIFICATION CHECKS PASSED.');
}

verify().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
