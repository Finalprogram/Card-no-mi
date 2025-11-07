const mongoose = require('mongoose');
require('dotenv').config();
const logger = require('../config/logger');

const connectDB = async () => {
  try {
    const MONGO_URI = process.env.MONGODB_URI;
    await mongoose.connect(MONGO_URI);
    logger.info('MongoDB connected');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
