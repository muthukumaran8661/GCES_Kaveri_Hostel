const User = require('../models/User');

const FACULTY_ACCOUNTS = [
  // CSE
  { name: 'Arun Kumar', staffId: 'ArunKumar@123', department: 'CSE', year: 'I Year', email: 'arunkumarfaculty@gmail.com', phone: '9876543210', defaultPassword: 'ArunKumar@123' },
  { name: 'Bala Kumar', staffId: 'BalaKumar@123', department: 'CSE', year: 'II Year', email: 'balakumarfaculty@gmail.com', phone: '8765432109', defaultPassword: 'BalaKumar@123' },
  { name: 'Dinesh Kumar', staffId: 'DineshKumar@123', department: 'CSE', year: 'III Year', email: 'dineshkumarfaculty@gmail.com', phone: '7654321098', defaultPassword: 'DineshKumar@123' },
  { name: 'Karthik Raj', staffId: 'KarthikRaj@123', department: 'CSE', year: 'IV Year', email: 'karthikrajfaculty@gmail.com', phone: '9543216780', defaultPassword: 'KarthikRaj@123' },

  // ECE
  { name: 'Anand Kumar', staffId: 'AnandKumar@123', department: 'ECE', year: 'I Year', email: 'anandkumarfaculty@gmail.com', phone: '9432167850', defaultPassword: 'AnandKumar@123' },
  { name: 'Ganesh Raj', staffId: 'GaneshRaj@123', department: 'ECE', year: 'II Year', email: 'ganeshrajfaculty@gmail.com', phone: '8321679450', defaultPassword: 'GaneshRaj@123' },
  { name: 'Hari Kumar', staffId: 'HariKumar@123', department: 'ECE', year: 'III Year', email: 'harikumarfaculty@gmail.com', phone: '7216594380', defaultPassword: 'HariKumar@123' },
  { name: 'Manoj Kumar', staffId: 'ManojKumar@123', department: 'ECE', year: 'IV Year', email: 'manojkumarfaculty@gmail.com', phone: '9182736450', defaultPassword: 'ManojKumar@123' },

  // EEE
  { name: 'Prakash Raj', staffId: 'PrakashRaj@123', department: 'EEE', year: 'I Year', email: 'prakashrajfaculty@gmail.com', phone: '8098765432', defaultPassword: 'PrakashRaj@123' },
  { name: 'Ravi Kumar', staffId: 'RaviKumar@123', department: 'EEE', year: 'II Year', email: 'ravikumarfaculty@gmail.com', phone: '7986543210', defaultPassword: 'RaviKumar@123' },
  { name: 'Suresh Babu', staffId: 'SureshBabu@123', department: 'EEE', year: 'III Year', email: 'sureshbabufaculty@gmail.com', phone: '6875432109', defaultPassword: 'SureshBabu@123' },
  { name: 'Vignesh Kumar', staffId: 'VigneshKumar@123', department: 'EEE', year: 'IV Year', email: 'vigneshkumarfaculty@gmail.com', phone: '9765123480', defaultPassword: 'VigneshKumar@123' },

  // Mechanical
  { name: 'Ajay Kumar', staffId: 'AjayKumar@123', department: 'Mechanical', year: 'I Year', email: 'ajaykumarfaculty@gmail.com', phone: '8654321790', defaultPassword: 'AjayKumar@123' },
  { name: 'Bharath Raj', staffId: 'BharathRaj@123', department: 'Mechanical', year: 'II Year', email: 'bharathrajfaculty@gmail.com', phone: '7543216890', defaultPassword: 'BharathRaj@123' },
  { name: 'Naveen Kumar', staffId: 'NaveenKumar@123', department: 'Mechanical', year: 'III Year', email: 'naveenkumarfaculty@gmail.com', phone: '9432108765', defaultPassword: 'NaveenKumar@123' },
  { name: 'Santhosh Kumar', staffId: 'SanthoshKumar@123', department: 'Mechanical', year: 'IV Year', email: 'santhoshkumarfaculty@gmail.com', phone: '8321097654', defaultPassword: 'SanthoshKumar@123' },

  // Civil
  { name: 'Ashok Kumar', staffId: 'AshokKumar@123', department: 'Civil', year: 'I Year', email: 'ashokkumarfaculty@gmail.com', phone: '9213456780', defaultPassword: 'AshokKumar@123' },
  { name: 'Deepak Raj', staffId: 'DeepakRaj@123', department: 'Civil', year: 'II Year', email: 'deepakrajfaculty@gmail.com', phone: '8102345679', defaultPassword: 'DeepakRaj@123' },
  { name: 'Mohan Kumar', staffId: 'MohanKumar@123', department: 'Civil', year: 'III Year', email: 'mohankumarfaculty@gmail.com', phone: '7890123456', defaultPassword: 'MohanKumar@123' },
  { name: 'Praveen Kumar', staffId: 'PraveenKumar@123', department: 'Civil', year: 'IV Year', email: 'praveenkumarfaculty@gmail.com', phone: '6981234507', defaultPassword: 'PraveenKumar@123' },

  // Mechatronics
  { name: 'Gokul Raj', staffId: 'GokulRaj@123', department: 'Mechatronics', year: 'I Year', email: 'gokulrajfaculty@gmail.com', phone: '9871203456', defaultPassword: 'GokulRaj@123' },
  { name: 'Lokesh Kumar', staffId: 'LokeshKumar@123', department: 'Mechatronics', year: 'II Year', email: 'lokeshkumarfaculty@gmail.com', phone: '8762103459', defaultPassword: 'LokeshKumar@123' },
  { name: 'Sanjay Kumar', staffId: 'SanjayKumar@123', department: 'Mechatronics', year: 'III Year', email: 'sanjaykumarfaculty@gmail.com', phone: '7654302189', defaultPassword: 'SanjayKumar@123' },
  { name: 'Vijay Raj', staffId: 'VijayRaj@123', department: 'Mechatronics', year: 'IV Year', email: 'vijayrajfaculty@gmail.com', phone: '9543102786', defaultPassword: 'VijayRaj@123' }
];

const FACULTY_ALLOWLIST_USERNAMES = FACULTY_ACCOUNTS.map(f => f.staffId.toLowerCase());

async function seedFacultyAccounts() {
  try {
    for (const f of FACULTY_ACCOUNTS) {
      const username = f.staffId.toLowerCase();
      let existingUser = await User.findOne({ username });

      if (!existingUser) {
        await User.create({
          username: username,
          password: f.defaultPassword,
          role: 'faculty',
          name: f.name,
          staffId: f.staffId,
          designation: 'Faculty',
          department: f.department,
          year: f.year,
          email: f.email,
          phone: f.phone,
          status: 'active'
        });
        console.log(`[Seed] Pre-created Faculty Advisor account: ${f.name} (${f.department} - ${f.year})`);
      } else {
        // Enforce fixed profile details for pre-seeded faculty accounts
        existingUser.role = 'faculty';
        existingUser.name = f.name;
        existingUser.staffId = f.staffId;
        existingUser.designation = 'Faculty';
        existingUser.department = f.department;
        existingUser.year = f.year;
        existingUser.email = f.email;
        existingUser.phone = f.phone;
        existingUser.status = 'active';

        await existingUser.save();
        console.log(`[Seed] Verified Faculty Advisor account: ${f.name} (${f.department} - ${f.year})`);
      }
    }

    // Ensure any non-allowlisted faculty accounts are deactivated
    await User.updateMany(
      {
        role: 'faculty',
        username: { $nin: FACULTY_ALLOWLIST_USERNAMES }
      },
      { status: 'inactive' }
    );

    console.log('[Seed] Predefined 24 Faculty Advisor Account System verified.');
  } catch (error) {
    console.error('[Seed Error] Failed to seed Faculty accounts:', error);
  }
}

module.exports = { seedFacultyAccounts, FACULTY_ALLOWLIST_USERNAMES, FACULTY_ACCOUNTS };
