const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const User = require('../models/User');

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB successfully.');

    // 1. Fetch all staff/faculty/admin records
    const allStaff = await User.find({ role: { $in: ['staff', 'faculty', 'admin'] } });
    console.log(`Found ${allStaff.length} total staff/faculty/admin records in database.`);

    const muthuAccount = allStaff.find(u => 
      (u.username && u.username.toLowerCase() === 'muthu@123') ||
      (u.staffId && u.staffId.toLowerCase() === 'muthu@123')
    );

    if (!muthuAccount) {
      console.error('ERROR: Could not locate Muthukumaran G (muthu@123) account! Aborting deletion.');
      process.exit(1);
    }

    console.log(`Verified Muthukumaran G account: ID=${muthuAccount._id}, username=${muthuAccount.username}, staffId=${muthuAccount.staffId}, name=${muthuAccount.name}`);

    // 2. Identify records to delete
    const toDelete = allStaff.filter(u => u._id.toString() !== muthuAccount._id.toString());
    console.log(`Number of records to delete: ${toDelete.length}`);

    toDelete.forEach(u => {
      console.log(`Deleting: [${u.role}] ${u.name || 'No Name'} (${u.username || u.staffId})`);
    });

    // 3. Delete all other staff accounts permanently
    const deleteResult = await User.deleteMany({
      role: { $in: ['staff', 'faculty', 'admin'] },
      _id: { $ne: muthuAccount._id }
    });

    console.log(`Successfully deleted ${deleteResult.deletedCount} staff records.`);

    // 4. Verify remaining staff in database
    const remainingStaff = await User.find({ role: { $in: ['staff', 'faculty', 'admin'] } });
    console.log(`Remaining staff records in database: ${remainingStaff.length}`);
    remainingStaff.forEach(u => {
      console.log(`Remaining staff: [${u.role}] ${u.name} (username: ${u.username}, staffId: ${u.staffId}, department: ${u.department}, year: ${u.year}, status: ${u.status})`);
    });

    // 5. Verify student records are completely untouched
    const studentCount = await User.countDocuments({ role: 'student' });
    console.log(`Verified ${studentCount} student accounts remain untouched.`);

    console.log('Staff cleanup completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error during staff deletion:', error);
    process.exit(1);
  }
}

run();
