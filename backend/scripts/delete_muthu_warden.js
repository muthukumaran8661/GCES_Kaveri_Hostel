const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const DEFAULT_URI = 'mongodb+srv://muthukumarangces_db_user:WEZBW13IqJpjvKLL@cluster0.m6cqhkp.mongodb.net/outformdb?appName=Cluster0';
const uri = process.env.MONGO_URI || DEFAULT_URI;

async function deleteMuthuWarden() {
  console.log('[Delete Warden Script] Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('[Delete Warden Script] Connected successfully.');

  const db = mongoose.connection.db;

  const filter = {
    $or: [
      { username: { $regex: /^muthu@123$/i } },
      { staffId: { $regex: /^muthu@123$/i } },
      { name: { $regex: /^muthukumaran\s*g$/i } },
      { email: { $regex: /muthu\s*warden@gmail\.com/i } }
    ]
  };

  const collectionsToCheck = ['wardens', 'staff', 'users'];

  for (const colName of collectionsToCheck) {
    try {
      const col = db.collection(colName);
      const matchingDocs = await col.find(filter).toArray();

      if (matchingDocs.length > 0) {
        console.log(`[Delete Warden Script] Found ${matchingDocs.length} matching document(s) in '${colName}':`);
        matchingDocs.forEach((doc, idx) => {
          console.log(`  ${idx + 1}. ID: ${doc._id} | Name: ${doc.name} | Username: ${doc.username} | StaffID: ${doc.staffId} | Email: ${doc.email} | Role: ${doc.role}`);
        });

        const deleteResult = await col.deleteMany(filter);
        console.log(`[Delete Warden Script] Deleted ${deleteResult.deletedCount} document(s) from '${colName}'.`);
      } else {
        console.log(`[Delete Warden Script] No matching Warden documents found in '${colName}'.`);
      }
    } catch (err) {
      console.warn(`[Delete Warden Script] Note on collection '${colName}':`, err.message);
    }
  }

  // Verification
  console.log('\n[Delete Warden Script] Verifying complete removal across all collections:');
  let remainingCount = 0;
  for (const colName of collectionsToCheck) {
    const col = db.collection(colName);
    const count = await col.countDocuments(filter);
    console.log(`  - '${colName}': ${count} remaining`);
    remainingCount += count;
  }

  if (remainingCount === 0) {
    console.log('\n✅ [SUCCESS] Warden Muthukumaran G (Muthu@123) has been completely and permanently removed from the database.');
  } else {
    console.error(`\n❌ [WARNING] ${remainingCount} record(s) still match the filter!`);
  }

  // List remaining wardens for audit
  const remainingWardens = await db.collection('wardens').find({}).toArray();
  console.log(`\nRemaining Active Wardens in 'wardens' collection (${remainingWardens.length}):`);
  remainingWardens.forEach((w, idx) => {
    console.log(`  ${idx + 1}. ${w.name} | StaffID: ${w.staffId} | Username: ${w.username} | Year: ${w.year || w.assignedYear} | Role: ${w.role}`);
  });

  await mongoose.disconnect();
}

deleteMuthuWarden().catch(err => {
  console.error('[Delete Warden Script Error]:', err);
  process.exit(1);
});
