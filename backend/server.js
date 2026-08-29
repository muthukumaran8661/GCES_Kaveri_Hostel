const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
const { seedWardenAccounts } = require('./config/seedWardens');

// Load env vars from backend/.env or parent env
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

// Connect to Database & Seed Fixed Warden Accounts
connectDB().then(() => {
  seedWardenAccounts();
}).catch(() => {
  // If connectDB is callback based, invoke seedWardenAccounts
  seedWardenAccounts();
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
});
