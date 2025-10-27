// src/services/melhorEnvioClient.js
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const logger = require('../config/logger');

const BASE_URL = process.env.MELHOR_ENVIO_BASE_URL || 'https://www.melhorenvio.com.br';
const CALCULATE_PATH = '/api/v2/me/shipment/calculate';
const TOKEN = process.env.MELHOR_ENVIO_TOKEN;
const USER_AGENT = process.env.MELHOR_ENVIO_USER_AGENT || 'Aplicação (email para contato técnico)';

if (!TOKEN) {
  logger.warn('[melhor-envio] MELHOR_ENVIO_TOKEN não definido. Configure seu .env');
}

/**
 * Calcula o frete para um pacote usando a API do Melhor Envio.
 */
async function cotarFreteMelhorEnvio({
  fromPostalCode,
  toPostalCode,
  // Em vez de produtos, agora aceitamos um único pacote
  pkg, // { width, height, length, weight, insurance_value }
  services = '1,2,18', // Exemplo: PAC, SEDEX, Jadlog.Package
  receipt = false,
  ownHand = false,
}) {
  const url = new URL(CALCULATE_PATH, BASE_URL).toString();

  const payload = {
    from: { postal_code: fromPostalCode },
    to: { postal_code: toPostalCode },
    // A API do Melhor Envio aceita tanto 'products' quanto 'package'
    package: {
      width: pkg.width,
      height: pkg.height,
      length: pkg.length,
      weight: pkg.weight,
      insurance_value: pkg.insurance_value,
    },
    options: {
      receipt,
      own_hand: ownHand,
    },
    services,
  };

  logger.info('[melhor-envio] Payload enviado:', JSON.stringify(payload, null, 2));
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`[melhor-envio] ${res.status} ${res.statusText} ${text}`);
    }

    return JSON.parse(text);

  } catch (error) {
    logger.error(`[melhor-envio] Falha ao calcular o frete: ${error.message}`);
    throw error; // Re-lança o erro para ser tratado pelo chamador
  }
}

const ADD_TO_CART_PATH = '/api/v2/me/cart';

/**
 * Adiciona um item ao carrinho de compras do Melhor Envio.
 * @param {object} shipmentDetails - Detalhes da remessa.
 * @returns {Promise<object>} - A resposta da API.
 */
async function addItemToCart(shipmentDetails) {
  const url = new URL(ADD_TO_CART_PATH, BASE_URL).toString();

  logger.info('[melhor-envio] Adicionando item ao carrinho com payload:', JSON.stringify(shipmentDetails, null, 2));

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify(shipmentDetails),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`[melhor-envio] ${res.status} ${res.statusText} ${text}`);
    }

    return JSON.parse(text);

  } catch (error) {
    logger.error(`[melhor-envio] Falha ao adicionar item ao carrinho: ${error.message}`);
    throw error;
  }
}

const CHECKOUT_PATH = '/api/v2/me/shipment/checkout';

/**
 * Realiza o checkout dos envios no carrinho do Melhor Envio.
 * @param {Array<string>} orders - IDs dos pedidos a serem comprados.
 * @returns {Promise<object>} - A resposta da API.
 */
async function purchaseShipments(orders) {
  const url = new URL(CHECKOUT_PATH, BASE_URL).toString();

  logger.info('[melhor-envio] Realizando checkout com payload:', JSON.stringify({ orders }, null, 2));

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({ orders }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`[melhor-envio] ${res.status} ${res.statusText} ${text}`);
    }

    return JSON.parse(text);

  } catch (error) {
    logger.error(`[melhor-envio] Falha ao realizar checkout: ${error.message}`);
    throw error;
  }
}

const PRINT_PATH = '/api/v2/me/shipment/print';

/**
 * Obtém os links para impressão das etiquetas do Melhor Envio.
 * @param {Array<string>} orders - IDs dos pedidos para os quais as etiquetas serão impressas.
 * @returns {Promise<object>} - A resposta da API contendo os links de impressão.
 */
async function printLabels(orders) {
  const url = new URL(PRINT_PATH, BASE_URL).toString();

  logger.info('[melhor-envio] Solicitando links de impressão para os pedidos:', JSON.stringify({ orders }, null, 2));

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({ orders }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`[melhor-envio] ${res.status} ${res.statusText} ${text}`);
    }

    return JSON.parse(text);

  } catch (error) {
    logger.error(`[melhor-envio] Falha ao obter links de impressão: ${error.message}`);
    throw error;
  }
}

module.exports = {
  cotarFreteMelhorEnvio,
  addItemToCart,
  purchaseShipments,
  printLabels,
};