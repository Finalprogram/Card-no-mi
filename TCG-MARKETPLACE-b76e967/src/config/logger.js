const winston = require('winston');
const LokiTransport = require('winston-loki');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple(),
        }),
        new winston.transports.File({ filename: 'logs/app.log' }),
        new LokiTransport({
            host: 'http://localhost:3100',
            labels: { app: 'TCG-MARKETPLACE' },
            json: true,
            format: winston.format.json(),
            replaceTimestamp: true,
            onConnectionError: (err) => console.error(err),
        }),
    ],
});

module.exports = logger;
