const Staff = require('../models/Staff');

const FACULTY_ACCOUNTS = [];

const FACULTY_ALLOWLIST_USERNAMES = [];

async function seedFacultyAccounts() {
  // Predefined faculty accounts are managed dynamically via Admin Control in 'staff' collection
}

module.exports = { seedFacultyAccounts, FACULTY_ALLOWLIST_USERNAMES, FACULTY_ACCOUNTS };
