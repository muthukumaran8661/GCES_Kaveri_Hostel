const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Load env vars from backend/.env or parent env FIRST
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const connectDB = require('./config/db');
const { seedWardenAccounts } = require('./config/seedWardens');
const { seedFacultyAccounts } = require('./config/seedFaculty');
const { runMigration } = require('./scripts/migrate_to_collections');
const { getFromAddress } = require('./utils/mailer');


// Connect to Database, Run Migration, & Seed Fixed Accounts
connectDB().then(async () => {
  await runMigration();
  seedWardenAccounts();
  seedFacultyAccounts();
}).catch(() => {
  seedWardenAccounts();
  seedFacultyAccounts();
});

const app = express();

// Body parser & CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/qr', require('./routes/qrRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/staff', require('./routes/staffRoutes'));
app.use('/api/wardens', require('./routes/wardenRoutes'));

// Serve Frontend Static Files in Production / Deployment
const frontendDist = path.join(__dirname, '../frontend/dist');
const backendDist = path.join(__dirname, 'dist');

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else if (fs.existsSync(backendDist)) {
  app.use(express.static(backendDist));
  app.use((req, res) => {
    res.sendFile(path.join(backendDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const fromAddr = getFromAddress();
    console.log(`[Mailer System] Resend API configured — OTP emails enabled. Sending from: ${fromAddr}`);
  } else {
    console.log('[Mailer System] WARNING: RESEND_API_KEY is not set. OTP emails are disabled.');
  }
});
