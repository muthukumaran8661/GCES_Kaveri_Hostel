const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables if running directly
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const DEFAULT_URI = 'mongodb+srv://muthukumarangces_db_user:WEZBW13IqJpjvKLL@cluster0.m6cqhkp.mongodb.net/outformdb?appName=Cluster0';

async function runMigration() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || DEFAULT_URI;

  const isConnectedLocally = mongoose.connection.readyState === 1;
  if (!isConnectedLocally) {
    await mongoose.connect(uri);
    console.log('[Migration] Connected to MongoDB database successfully.');
  }

  try {
    const db = mongoose.connection.db;

    // Check if 'users' collection exists
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    if (!collectionNames.includes('users')) {
      console.log('[Migration] No "users" collection found to migrate. Skipping.');
      return;
    }

    const usersCol = db.collection('users');
    const studentsCol = db.collection('students');
    const staffCol = db.collection('staff');
    const wardensCol = db.collection('wardens');

    const allUsers = await usersCol.find({}).toArray();
    console.log(`[Migration] Found ${allUsers.length} documents in "users" collection to evaluate.`);

    let studentsAdded = 0;
    let staffAdded = 0;
    let wardensAdded = 0;
    let skipped = 0;

    for (const u of allUsers) {
      const roleLower = (u.role || '').toLowerCase();

      if (roleLower === 'student') {
        // Check if student already exists in students collection
        const exists = await studentsCol.findOne({
          $or: [
            { _id: u._id },
            { username: u.username }
          ]
        });

        if (!exists) {
          const studentDoc = {
            _id: u._id,
            name: u.name || 'Student',
            username: u.username,
            registerNumber: u.reg || u.registerNumber || u.studentId || '',
            reg: u.reg || u.studentId || '',
            studentId: u.studentId || u.username || '',
            email: u.email || '',
            phone: u.phone || '',
            department: u.department || '',
            year: u.year || '',
            room: u.room || '',
            homeAddress: u.homeAddress || '',
            role: 'student',
            status: u.status || 'active',
            password: u.password, // Preserve exact hashed password
            resetOtp: u.resetOtp || '',
            resetOtpExpire: u.resetOtpExpire || null,
            createdAt: u.createdAt || new Date()
          };
          await studentsCol.insertOne(studentDoc);
          studentsAdded++;
        } else {
          skipped++;
        }
      } else if (roleLower === 'faculty' || roleLower === 'faculty advisor') {
        // Check if faculty already exists in staff collection
        const exists = await staffCol.findOne({
          $or: [
            { _id: u._id },
            { username: u.username },
            { staffId: u.staffId || u.username }
          ]
        });

        if (!exists) {
          const assignedY = u.year || u.assignedYear || '';
          const staffDoc = {
            _id: u._id,
            name: u.name || 'Faculty Advisor',
            username: u.username,
            staffId: u.staffId || u.username,
            email: u.email || '',
            phone: u.phone || '',
            department: u.department || '',
            assignedYear: assignedY,
            year: assignedY,
            designation: u.designation || 'Faculty Advisor',
            role: 'Faculty Advisor',
            status: u.status || 'active',
            password: u.password, // Preserve exact hashed password
            resetOtp: u.resetOtp || '',
            resetOtpExpire: u.resetOtpExpire || null,
            createdAt: u.createdAt || new Date()
          };
          await staffCol.insertOne(staffDoc);
          staffAdded++;
        } else {
          skipped++;
        }
      } else if (roleLower === 'staff' || roleLower === 'warden' || roleLower === 'admin') {
        // Check if warden already exists in wardens collection
        const exists = await wardensCol.findOne({
          $or: [
            { _id: u._id },
            { username: u.username },
            { staffId: u.staffId || u.username }
          ]
        });

        if (!exists) {
          const assignedY = u.year || u.assignedYear || 'All Years';
          const wardenDoc = {
            _id: u._id,
            name: u.name || 'Warden',
            username: u.username,
            staffId: u.staffId || u.username,
            email: u.email || '',
            phone: u.phone || '',
            department: u.department || 'Hostel Administration',
            assignedYear: assignedY,
            year: assignedY,
            designation: u.designation || (roleLower === 'admin' ? 'Hostel Administrator' : 'Warden'),
            role: roleLower === 'admin' ? 'admin' : 'Warden',
            status: u.status || 'active',
            password: u.password, // Preserve exact hashed password
            resetOtp: u.resetOtp || '',
            resetOtpExpire: u.resetOtpExpire || null,
            createdAt: u.createdAt || new Date()
          };
          await wardensCol.insertOne(wardenDoc);
          wardensAdded++;
        } else {
          skipped++;
        }
      }
    }

    console.log('[Migration] Migration summary:');
    console.log(`  - Students added to "students": ${studentsAdded}`);
    console.log(`  - Faculty Advisors added to "staff": ${staffAdded}`);
    console.log(`  - Wardens/Admins added to "wardens": ${wardensAdded}`);
    console.log(`  - Already existing (skipped): ${skipped}`);
    console.log('[Migration] NOTE: Original "users" collection was preserved as backup and NOT modified.');

  } catch (err) {
    console.error('[Migration] Error executing migration:', err);
  } finally {
    if (!isConnectedLocally) {
      await mongoose.disconnect();
    }
  }
}

// Allow direct execution: node backend/scripts/migrate_to_collections.js
if (require.main === module) {
  runMigration().then(() => {
    console.log('[Migration] Completed.');
    process.exit(0);
  }).catch((err) => {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  });
}

module.exports = { runMigration };
