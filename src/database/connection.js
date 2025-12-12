const { Sequelize } = require('sequelize');
require('dotenv').config();
const logger = require('../config/logger');

const sequelize = new Sequelize(process.env.POSTGRES_URI, {
  dialect: 'postgres',
  logging: (msg) => logger.debug(msg),
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('PostgreSQL connected');
    // Sync database (create tables if not exist)
    await sequelize.sync();
    logger.info('Database synchronized');
  } catch (error) {
    logger.error('PostgreSQL connection error:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
