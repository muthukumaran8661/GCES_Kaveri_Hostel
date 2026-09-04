const mongoose = require('mongoose');
const connectDB = require('../config/db');

async function checkCollections() {
  await connectDB();
  const db = mongoose.connection.db;

  const studentsCount = await db.collection('students').countDocuments();
  const staffCount = await db.collection('staff').countDocuments();
  const wardensCount = await db.collection('wardens').countDocuments();
  const usersCount = await db.collection('users').countDocuments();

  console.log('Document counts:', {
    students: studentsCount,
    staff: staffCount,
    wardens: wardensCount,
    users: usersCount
  });

  const allUsers = await db.collection('users').find({}).toArray();
  console.log('Users collection docs:', allUsers.map(u => ({ id: u._id, username: u.username, role: u.role })));

  const allStudents = await db.collection('students').find({}).toArray();
  console.log('Students collection docs:', allStudents.map(s => ({ id: s._id, username: s.username, role: s.role })));

  process.exit(0);
}

checkCollections().catch(err => {
  console.error(err);
  process.exit(1);
});
