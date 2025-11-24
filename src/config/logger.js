const winston = require('winston');
const LokiTransport = require('winston-loki');

// Criar array de transports
const transports = [
    new winston.transports.Console({
        format: winston.format.simple(),
    }),
    new winston.transports.File({ filename: 'logs/app.log' })
];

// Adicionar Loki transport
transports.push(
    new LokiTransport({
        host: 'http://localhost:3100',
        labels: { app: 'TCG-MARKETPLACE' },
        json: true,
        format: winston.format.json(),
        replaceTimestamp: true,
        onConnectionError: (err) => {
            console.error('Erro de conexão com o Loki:', err);
        },
    })
);

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: transports,
});

module.exports = logger;
