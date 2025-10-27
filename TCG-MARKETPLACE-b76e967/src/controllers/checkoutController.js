// src/controllers/checkoutController.js

const User = require('../models/User');
const Setting = require('../models/Setting'); // NEW IMPORT
// const { cotarFrete } = require('../services/correiosClient'); // Comentado para trocar para Melhor Envio
const { cotarFreteMelhorEnvio, addItemToCart } = require('../services/melhorEnvioClient');
const { estimatePackageDims } = require('../services/packaging');

// Util: garante que o carrinho exista
function getCart(req) {
  if (!req.session.cart) req.session.cart = { items: [], totalQty: 0, totalPrice: 0 };
  return req.session.cart;
}

function toMoney(n) { return Number(n || 0); }

// New helper function to calculate fees for cart items
async function calculateCartFees(cartItems) {
  let totalMarketplaceFee = 0;
  let totalSellerNet = 0;
  let subtotal = 0;
  const processedItems = [];

  for (const item of cartItems) {
    const seller = await User.findById(item.vendorId);
    if (!seller) {
      console.warn(`Vendedor ${item.vendorId} não encontrado para o item ${item.cardId}.`);
      item.marketplaceFee = 0;
      item.sellerNet = item.price * item.qty;
      processedItems.push(item);
      totalSellerNet += item.sellerNet;
      subtotal += item.price * item.qty;
      continue;
    }

    let feePercentage = seller.fee_override_percentage;

    if (feePercentage === null || feePercentage === undefined) {
      const settingKey = `fee_${seller.accountType}_percentage`;
      const defaultFeeSetting = await Setting.findOne({ key: settingKey });
      feePercentage = defaultFeeSetting ? defaultFeeSetting.value : 0; // Fallback to 0 if setting not found
    }

    const itemTotalPrice = item.price * item.qty;
    const itemMarketplaceFee = itemTotalPrice * (feePercentage / 100);
    const itemSellerNet = itemTotalPrice - itemMarketplaceFee;

    totalMarketplaceFee += itemMarketplaceFee;
    totalSellerNet += itemSellerNet;
    subtotal += itemTotalPrice;

    processedItems.push({
      ...item,
      marketplaceFee: Number(itemMarketplaceFee.toFixed(2)),
      sellerNet: Number(itemSellerNet.toFixed(2)),
    });
  }

  const fixedShipping = 0; // This should ideally come from quoteDetailed or user selection
  const grandTotal = subtotal + fixedShipping; // This is what the buyer pays

  return {
    processedItems,
    subtotal: Number(subtotal.toFixed(2)),
    shipping: Number(fixedShipping.toFixed(2)),
    grand: Number(grandTotal.toFixed(2)),
    marketplaceFee: Number(totalMarketplaceFee.toFixed(2)),
    sellerNet: Number(totalSellerNet.toFixed(2)),
  };
}

/** GET /checkout */
async function showCheckout(req, res) {
  const cart = getCart(req);
  const items = (cart.items || []).map(it => ({
    key: it.key,
    cardId: it.cardId,
    vendorId: it.vendorId,
    qty: Number(it.qty || 0),
    price: toMoney(it.price),
    meta: it.meta || {}
  }));

  // Use the new helper function to calculate fees and totals
  const calculatedTotals = await calculateCartFees(items);

  // agrupa por vendedor (this part needs to use calculatedTotals.processedItems)
  const map = new Map();
  for (const it of calculatedTotals.processedItems) { // Use processedItems here
    const sid = it.vendorId || 'sem-vendedor';
    const group = map.get(sid) || {
      sellerId: sid,
      sellerName: (it.meta && it.meta.sellerName) || 'Vendedor',
      items: []
    };
    group.items.push({
      name: (it.meta && it.meta.cardName) || it.cardId,
      imageUrl: (it.meta && it.meta.imageUrl) || '',
      condition: (it.meta && it.meta.condition) || '',
      qty: it.qty,
      unit: it.price,
      line: Number((it.qty * it.price).toFixed(2)),
      // Add fee details to item for display if needed
      marketplaceFee: it.marketplaceFee,
      sellerNet: it.sellerNet,
    });
    map.set(sid, group);
  }
  const groups = Array.from(map.values());

  const message = req.session.message;
  delete req.session.message; // Clear the message after displaying it

  return res.render('pages/checkout', {
    groups, // <- usado para listar cartas por vendedor
    totals: calculatedTotals, // Pass the full calculated totals object
    message, // Pass the message to the template
  });
}

/** POST /checkout/quote-detailed */
async function quoteDetailed(req, res) {
  try {
    const { zip } = req.body || {};
    if (!zip) return res.json({ ok: false, error: 'zip required' });

    const cart = getCart(req);
    const items = cart.items || [];

    // 1. Agrupar itens por vendedor
    const itemsBySeller = items.reduce((acc, item) => {
      const sellerId = item.vendorId || 'sem-vendedor';
      if (!acc[sellerId]) acc[sellerId] = [];
      acc[sellerId].push(item);
      return acc;
    }, {});

    const packages = [];
    const globalCepOrigem = process.env.MELHOR_ENVIO_CEP_ORIGEM; // Usar CEP de origem do Melhor Envio

    // 2. Para cada vendedor, estimar pacote e cotar frete
    for (const sellerId in itemsBySeller) {
      const sellerItems = itemsBySeller[sellerId];
      const sellerName = sellerItems[0]?.meta?.sellerName || 'Vendedor';

      // Buscar CEP do vendedor no banco de dados
      let cepOrigem = globalCepOrigem;
      if (sellerId !== 'sem-vendedor') {
        const seller = await User.findById(sellerId);
        if (seller && seller.address && seller.address.cep) {
          cepOrigem = seller.address.cep;
        } else {
          console.warn(`[checkout] Vendedor ${sellerId} sem CEP definido. Usando CEP global.`);
        }
      }

      // Estimar dimensões e peso
      const { comprimentoCm, larguraCm, alturaCm, pesoKg } = estimatePackageDims(sellerItems);
      const insuranceValue = sellerItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

      // Cotar frete usando o Melhor Envio
      const services = '1,2,18'; // Exemplo: PAC, SEDEX, Jadlog.Package
      const options = await cotarFreteMelhorEnvio({
        fromPostalCode: cepOrigem,
        toPostalCode: zip,
        pkg: {
          width: larguraCm,
          height: alturaCm,
          length: comprimentoCm,
          weight: pesoKg,
          insurance_value: insuranceValue,
        },
        services,
      });

      // Filtra apenas as opções válidas (sem erro) e ordena por preço
      const validOptions = options
        .filter(opt => !opt.error)
        .map(opt => ({ // Adapta o formato da resposta
          servico: opt.id,
          nome: opt.name,
          preco: parseFloat(opt.custom_price || opt.price),
          prazoEmDias: opt.delivery_time,
        }));

      validOptions.sort((a, b) => (a.preco || 0) - (b.preco || 0));
      
      const chosen = validOptions.length > 0 ? validOptions[0] : null;

      packages.push({ sellerId, sellerName, options: validOptions, chosen });
    }

    // 3. Calcular totais
    const subtotal = Number((cart.totalPrice || 0).toFixed(2));
    const shipping = packages.reduce((s, p) => s + (p.chosen?.preco || 0), 0);
    const totals = {
      subtotal,
      shipping: Number(shipping.toFixed(2)),
      grand: Number((subtotal + shipping).toFixed(2)),
    };

    res.json({ ok: true, packages, totals });

  } catch (e) {
    console.error('[checkout] quoteDetailed error:', e);
    res.json({ ok: false, error: e.message || 'quote failed' });
  }
}

/** POST /checkout/confirm  (ajuste ao seu fluxo de pedido) */
async function confirm(req, res) {
  try {
    const { shippingSelections, address } = req.body;
    const cart = getCart(req);
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).send('Carrinho vazio ou inválido.');
    }

    if (!shippingSelections || shippingSelections === '[]') {
      req.session.message = { type: 'error', text: 'Por favor, calcule e selecione uma opção de frete.' };
      return res.redirect('/checkout');
    }

    let totalMarketplaceFee = 0;
    let totalSellerNet = 0;
    const processedItems = [];

    for (const item of cart.items) {
      const seller = await User.findById(item.vendorId);
      if (!seller) {
        console.warn(`Vendedor ${item.vendorId} não encontrado para o item ${item.cardId}.`);
        item.marketplaceFee = 0;
        item.sellerNet = item.price * item.qty;
        processedItems.push(item);
        totalSellerNet += item.sellerNet;
        continue;
      }

      let feePercentage = seller.fee_override_percentage;

      if (feePercentage === null || feePercentage === undefined) {
        const settingKey = `fee_${seller.accountType}_percentage`;
        const defaultFeeSetting = await Setting.findOne({ key: settingKey });
        feePercentage = defaultFeeSetting ? defaultFeeSetting.value : 0;
      }

      const itemTotalPrice = item.price * item.qty;
      const itemMarketplaceFee = itemTotalPrice * (feePercentage / 100);
      const itemSellerNet = itemTotalPrice - itemMarketplaceFee;

      totalMarketplaceFee += itemMarketplaceFee;
      totalSellerNet += itemSellerNet;

      processedItems.push({
        ...item,
        marketplaceFee: Number(itemMarketplaceFee.toFixed(2)),
        sellerNet: Number(itemSellerNet.toFixed(2)),
      });
    }

    req.session.cart.items = processedItems;

    let shippingTotal = 0;
    if (shippingSelections) {
      const selections = JSON.parse(shippingSelections);
      shippingTotal = selections.reduce((total, selection) => total + selection.price, 0);
    }

    const subtotal = cart.totalPrice || 0;
    const grandTotal = subtotal + shippingTotal;

    req.session.totals = {
      subtotal: Number(subtotal.toFixed(2)),
      shipping: Number(shippingTotal.toFixed(2)),
      grand: Number(grandTotal.toFixed(2)),
      marketplaceFee: Number(totalMarketplaceFee.toFixed(2)),
      sellerNet: Number(totalSellerNet.toFixed(2)),
    };

    res.redirect('/payment');
  } catch (e) {
    console.error('Erro ao processar o checkout e calcular taxas:', e);
    res.status(500).send('Erro no servidor ao processar o checkout');
  }
}

module.exports = { showCheckout, quoteDetailed, confirm };