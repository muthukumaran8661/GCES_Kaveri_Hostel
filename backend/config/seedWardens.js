const User = require('../models/User');

const WARDEN_ALLOWLIST = [
  {
    username: 'muthu@123',
    staffId: 'Muthu@123',
    name: 'Muthukumaran G',
    designation: 'IV Year Warden',
    year: 'IV Year',
    email: 'muthuwarden@gmail.com',
    phone: '1234567890',
    envPasswordKey: 'WARDEN_MUTHU_PASSWORD',
    defaultPassword: 'Muthu@123'
  }
];

const ALLOWED_USERNAMES = WARDEN_ALLOWLIST.map(w => w.username);

async function seedWardenAccounts() {
  try {
    for (const w of WARDEN_ALLOWLIST) {
      const rawPassword = process.env[w.envPasswordKey] || w.defaultPassword;
      let existingUser = await User.findOne({ username: w.username });

      if (!existingUser) {
        // Create new seeded Warden account
        await User.create({
          username: w.username,
          password: rawPassword,
          role: 'staff',
          name: w.name,
          staffId: w.staffId,
          designation: w.designation,
          department: 'Hostel Administration',
          year: w.year,
          email: w.email,
          phone: w.phone,
          status: 'active'
        });
        console.log(`[Seed] Pre-created Warden account: ${w.staffId} (${w.year})`);
      } else {
        let modified = false;
        if (!existingUser.name) { existingUser.name = w.name; modified = true; }
        if (!existingUser.staffId) { existingUser.staffId = w.staffId; modified = true; }
        if (!existingUser.department) { existingUser.department = 'Hostel Administration'; modified = true; }
        if (!existingUser.year) { existingUser.year = w.year; modified = true; }
        if (!existingUser.designation) { existingUser.designation = w.designation; modified = true; }
        if (existingUser.email !== w.email) { existingUser.email = w.email; modified = true; }
        if (!existingUser.phone) { existingUser.phone = w.phone; modified = true; }
        if (process.env[w.envPasswordKey]) {
          existingUser.password = process.env[w.envPasswordKey];
          modified = true;
        }

        if (modified) {
          await existingUser.save();
        }
        console.log(`[Seed] Verified Warden account: ${w.staffId} (${existingUser.year})`);
      }
    }

    console.log('[Seed] Warden seed verification completed. Custom staff accounts preserved.');
  } catch (error) {
    console.error('[Seed Error] Failed to seed Warden accounts:', error);
  }
}

module.exports = { seedWardenAccounts, ALLOWED_USERNAMES };
