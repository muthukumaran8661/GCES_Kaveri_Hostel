const mongoose = require('mongoose');

const DEFAULT_URI = 'mongodb+srv://muthukumarangces_db_user:WEZBW13IqJpjvKLL@cluster0.m6cqhkp.mongodb.net/outformdb?appName=Cluster0';

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || DEFAULT_URI;
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
