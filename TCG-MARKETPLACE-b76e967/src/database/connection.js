const mongoose = require('mongoose');
require('dotenv').config();
const logger = require('../config/logger');

const connectDB = async () => {
  try {
    const MONGO_URI = "mongodb+srv://murilozqz21_db_user:DA0LlTV8vG6NIfJm@cluster0.ayosgna.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; // <-- COLOQUE SUA STRING COMPLETA AQUI
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info('MongoDB connected');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
