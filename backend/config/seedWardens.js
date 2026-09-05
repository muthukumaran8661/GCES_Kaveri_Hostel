const Warden = require('../models/Warden');

const WARDEN_ALLOWLIST = [];

const ALLOWED_USERNAMES = [];

async function seedWardenAccounts() {
  // Predefined warden accounts are managed dynamically in 'wardens' collection
}

module.exports = { seedWardenAccounts, ALLOWED_USERNAMES, WARDEN_ALLOWLIST };
