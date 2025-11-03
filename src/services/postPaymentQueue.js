// src/services/postPaymentQueue.js
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const logger = require('../config/logger');

// Configure Redis connection
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null, // Important for BullMQ
});

// Create a new queue
const postPaymentQueue = new Queue('post-payment', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times
    backoff: {
      type: 'exponential',
      delay: 1000, // Start with a 1-second delay
    },
  },
});

/**
 * Adds a post-payment job to the queue.
 * @param {string} orderId - The ID of the order to process.
 */
async function addPostPaymentJob(orderId) {
  try {
    await postPaymentQueue.add('process-order', { orderId }, {
      jobId: orderId, // Use orderId as jobId to prevent duplicates
      removeOnComplete: true, // Remove job from queue once completed
      removeOnFail: false, // Keep failed jobs for inspection
    });
    logger.info(`[queue] Job added for order ${orderId}`);
  } catch (error) {
    logger.error(`[queue] Error adding job for order ${orderId}:`, error);
  }
}

module.exports = {
  postPaymentQueue,
  addPostPaymentJob,
  redisConnection, // Export connection for worker
};
