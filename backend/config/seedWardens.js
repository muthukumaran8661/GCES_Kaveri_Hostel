const Warden = require('../models/Warden');

const WARDEN_ALLOWLIST = [
  {
    username: 'muthu@123',
    staffId: 'Muthu@123',
    name: 'Muthukumaran G',
    designation: 'IV Year Warden',
    year: 'IV Year',
    assignedYear: 'IV Year',
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
      let existingWarden = await Warden.findOne({ username: w.username });

      if (!existingWarden) {
        // Create new seeded Warden account in wardens collection
        await Warden.create({
          username: w.username,
          password: rawPassword,
          role: 'Warden',
          name: w.name,
          staffId: w.staffId,
          designation: w.designation,
          department: 'Hostel Administration',
          assignedYear: w.assignedYear || w.year,
          year: w.year,
          email: w.email,
          phone: w.phone,
          status: 'active'
        });
        console.log(`[Seed] Pre-created Warden account: ${w.staffId} (${w.year}) in wardens collection`);
      } else {
        let modified = false;
        if (!existingWarden.name) { existingWarden.name = w.name; modified = true; }
        if (!existingWarden.staffId) { existingWarden.staffId = w.staffId; modified = true; }
        if (!existingWarden.department) { existingWarden.department = 'Hostel Administration'; modified = true; }
        if (!existingWarden.assignedYear) { existingWarden.assignedYear = w.year; modified = true; }
        if (!existingWarden.year) { existingWarden.year = w.year; modified = true; }
        if (!existingWarden.designation) { existingWarden.designation = w.designation; modified = true; }
        if (existingWarden.email !== w.email) { existingWarden.email = w.email; modified = true; }
        if (!existingWarden.phone) { existingWarden.phone = w.phone; modified = true; }
        if (process.env[w.envPasswordKey]) {
          existingWarden.password = process.env[w.envPasswordKey];
          modified = true;
        }

        if (modified) {
          await existingWarden.save();
        }
        console.log(`[Seed] Verified Warden account: ${w.staffId} (${existingWarden.year}) in wardens collection`);
      }
    }

    console.log('[Seed] Warden seed verification completed. Custom staff accounts preserved.');
  } catch (error) {
    console.error('[Seed Error] Failed to seed Warden accounts:', error);
  }
}

module.exports = { seedWardenAccounts, ALLOWED_USERNAMES };
