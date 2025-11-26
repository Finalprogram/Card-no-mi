const winston = require('winston');

// Criar array de transports
const transports = [
    new winston.transports.Console({
        format: winston.format.simple(),
    }),
    new winston.transports.File({ filename: 'logs/app.log' })
];

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: transports,
});

module.exports = logger;
