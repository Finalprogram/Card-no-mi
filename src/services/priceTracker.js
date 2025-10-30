const Listing = require('../models/Listing');
const Card = require('../models/Card');
const PriceHistory = require('../models/PriceHistory');
const logger = require('../config/logger');

const recordPriceHistory = async () => {
  try {
    logger.info('Starting price history recording...');

    const listings = await Listing.find({ quantity: { $gt: 0 } }).populate('card');
    logger.info(`${listings.length} active listings found.`);

    const cardPrices = new Map();

    listings.forEach(listing => {
      if (listing.card) {
        const cardId = listing.card._id.toString();
        if (!cardPrices.has(cardId)) {
          cardPrices.set(cardId, { prices: [], card: listing.card });
        }
        cardPrices.get(cardId).prices.push(listing.price);
      }
    });

    logger.info(`Found ${cardPrices.size} unique cards with active listings.`);

    for (const [cardId, data] of cardPrices.entries()) {
      const avgPrice = data.prices.reduce((a, b) => a + b, 0) / data.prices.length;

      const newPriceHistory = new PriceHistory({
        card: cardId,
        price: avgPrice,
        date: new Date()
      });
      await newPriceHistory.save();
      logger.info(`PriceHistory saved for card ${cardId}: price=${avgPrice.toFixed(2)}, date=${newPriceHistory.date.toISOString()}`);

      data.card.averagePrice = avgPrice;

      const history = await PriceHistory.find({ card: cardId }).sort({ date: -1 }).limit(2);
      logger.info(`Price history for card ${cardId} (last 2 entries): ${JSON.stringify(history)}`);

      if (history.length < 2) {
        data.card.price_trend = 'stable';
        logger.info(`Price trend for card ${cardId}: stable (less than 2 history entries)`);
      } else {
        const [recentPrice, previousPrice] = history;
        logger.info(`Recent price: ${recentPrice.price}, Previous price: ${previousPrice.price}`);
        if (recentPrice.price > previousPrice.price) {
          data.card.price_trend = 'up';
          logger.info(`Price trend for card ${cardId}: up`);
        } else if (recentPrice.price < previousPrice.price) {
          data.card.price_trend = 'down';
          logger.info(`Price trend for card ${cardId}: down`);
        } else {
          data.card.price_trend = 'stable';
          logger.info(`Price trend for card ${cardId}: stable (prices are equal)`);
        }
      }
      await data.card.save();
      logger.info(`Card ${cardId} updated with averagePrice=${data.card.averagePrice.toFixed(2)} and price_trend=${data.card.price_trend}`);
    }

    logger.info('Price history recording complete.');
  } catch (error) {
    logger.error('Error recording price history:', error);
  }
};

module.exports = { recordPriceHistory };
