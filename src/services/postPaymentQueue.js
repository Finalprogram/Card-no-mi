// src/services/postPaymentQueue.js
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const logger = require('../config/logger');
const { processOrderPostPayment } = require('./postPaymentProcessor');

// Variáveis para Redis e Queue
let redisConnection = null;
let postPaymentQueue = null;

// Verificar se deve tentar conectar ao Redis
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

if (REDIS_ENABLED) {
  try {
    // Configure Redis connection
    redisConnection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
    });

    redisConnection.on('error', (err) => {
      logger.error('Erro no Redis:', err);
    });
    
    redisConnection.on('connect', () => {
      logger.info('Redis conectado com sucesso');
    });

    // Create queue
    postPaymentQueue = new Queue('post-payment', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });
  } catch (err) {
    logger.info('Redis não disponível - funcionalidades de fila desabilitadas');
    redisConnection = null;
    postPaymentQueue = null;
  }
} else {
  logger.info('Redis desabilitado via configuração');
}

/**
 * Adds a post-payment job to the queue.
 * @param {string} orderId - The ID of the order to process.
 */
async function addPostPaymentJob(orderId) {
  if (!postPaymentQueue || !redisConnection || redisConnection.status !== 'ready') {
    logger.warn(`[queue] Redis n?o dispon?vel - processando order ${orderId} diretamente`);
    try {
      await processOrderPostPayment(orderId);
    } catch (error) {
      logger.error(`[queue] Falha ao processar order ${orderId} diretamente:`, error);
    }
    return;
  }

  try {
    await postPaymentQueue.add('process-order', { orderId }, {
      jobId: orderId,
      removeOnComplete: true,
      removeOnFail: false,
    });
    logger.info(`[queue] Job added for order ${orderId}`);
  } catch (error) {
    logger.warn(`[queue] Error adding job for order ${orderId} - processando diretamente`);
    try {
      await processOrderPostPayment(orderId);
    } catch (err) {
      logger.error(`[queue] Falha ao processar order ${orderId} diretamente:`, err);
    }
  }
}


module.exports = {
  postPaymentQueue,
  addPostPaymentJob,
  redisConnection, // Export connection for worker
};
