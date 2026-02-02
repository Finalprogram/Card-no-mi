// src/workers/postPaymentWorker.js
const { Worker } = require('bullmq');
const Redis = require('ioredis');
let { redisConnection } = require('../services/postPaymentQueue');
const logger = require('../config/logger');
const { processOrderPostPayment } = require('../services/postPaymentProcessor');

if (!redisConnection && process.env.REDIS_ENABLED !== 'false') {
  redisConnection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  });

  redisConnection.on('error', (err) => {
    logger.error('Erro no Redis (worker):', err);
  });

  redisConnection.on('connect', () => {
    logger.info('Redis conectado com sucesso (worker)');
  });
}

let worker = null;

function startWorker() {
  if (worker || !redisConnection || redisConnection.status !== 'ready') {
    return;
  }

  worker = new Worker('post-payment', async (job) => {
    const { orderId } = job.data;
    logger.info(`[worker] Processing job for order ${orderId}`);
    await processOrderPostPayment(orderId);
  }, { connection: redisConnection });

  worker.on('completed', (job) => {
    logger.info(`[worker] Job ${job.id} has completed.`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[worker] Job ${job.id} has failed with ${err.message}`);
  });

  logger.info('[worker] Post-payment worker started.');
}

if (redisConnection) {
  if (redisConnection.status === 'ready') {
    startWorker();
  } else {
    logger.info('[worker] Redis conectando - aguardando para iniciar o worker.');
    redisConnection.once('ready', startWorker);
  }
} else {
  logger.info('[worker] Redis n?o dispon?vel - worker de post-payment n?o iniciado');
}
