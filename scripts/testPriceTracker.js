const connectDB = require('../src/database/connection');
const { recordPriceHistory } = require('../src/services/priceTracker');
const logger = require('../src/config/logger');

require('dotenv').config({ path: './.env' }); // Carrega as variáveis de ambiente

const runTest = async () => {
  await connectDB();
  logger.info('Database connected for price tracker test.');
  await recordPriceHistory();
  logger.info('Manual price history recording finished.');
  process.exit(0);
};

runTest().catch(err => {
  logger.error('Error during manual price history recording test:', err);
  process.exit(1);
});
