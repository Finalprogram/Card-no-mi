// src/controllers/sellerController.js
const Order = require('../models/Order');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Setting = require('../models/Setting');
const Card = require('../models/Card');
const { Op } = require('sequelize');
const melhorEnvioClient = require('../services/melhorEnvioClient'); // Importar o cliente do Melhor Envio
const notificationService = require('../services/notificationService');
const { sendOrderStatusEmail } = require('../services/emailService');

function addIdAlias(value) {
  if (value && value.id != null && value._id == null) {
    value._id = value.id;
  }
  return value;
}

function toPlainWithId(modelInstance) {
  if (!modelInstance) return null;
  const data = modelInstance.toJSON ? modelInstance.toJSON() : modelInstance;
  return addIdAlias(data);
}

function sellerItemMatches(item, sellerId) {
  return item && item.seller != null && item.seller.toString() === sellerId.toString();
}

function filterOrderItemsForSeller(order, sellerId) {
  const data = toPlainWithId(order);
  data.items = (data.items || []).filter(item => sellerItemMatches(item, sellerId));
  return data;
}

const getSalesData = async (sellerId, period) => {
  let startDate;
  if (period === '7days') {
    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === '30days') {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  const where = {
    status: { [Op.in]: ['Paid', 'Shipped', 'Delivered'] }
  };
  if (startDate) {
    where.createdAt = { [Op.gte]: startDate };
  }

  const orders = await Order.findAll({ where, order: [['createdAt', 'ASC']] });
  const daily = new Map();

  orders.forEach(order => {
    const items = order.items || [];
    items.forEach(item => {
      if (!sellerItemMatches(item, sellerId)) return;
      const dateKey = new Date(order.createdAt).toISOString().slice(0, 10);
      const current = daily.get(dateKey) || { totalSales: 0, totalOrders: 0 };
      current.totalSales += Number(item.price || 0) * Number(item.quantity || 0);
      current.totalOrders += 1;
      daily.set(dateKey, current);
    });
  });

  return Array.from(daily.entries()).map(([date, data]) => ({
    date,
    totalSales: data.totalSales,
    totalOrders: data.totalOrders
  }));
};

const getSalesTotalForPeriod = async (sellerId, startDate, endDate) => {
  const where = {
    status: { [Op.in]: ['Paid', 'Shipped', 'Delivered'] },
    createdAt: { [Op.gte]: startDate, [Op.lt]: endDate }
  };

  const orders = await Order.findAll({ where });
  let totalSales = 0;

  orders.forEach(order => {
    (order.items || []).forEach(item => {
      if (!sellerItemMatches(item, sellerId)) return;
      totalSales += Number(item.price || 0) * Number(item.quantity || 0);
    });
  });

  return totalSales;
};

const showSellerDashboard = async (req, res) => {
  try {
    const sellerId = req.session.user.id;
    const seller = await User.findByPk(sellerId); // Fetch seller user object

    if (!seller) {
      return res.status(404).send('Vendedor não encontrado.');
    }

    // Calculate seller's fee percentage
    let sellerFeePercentage = seller.fee_override_percentage;
    const settingKey = `fee_${seller.accountType}_percentage`;
    const defaultFeeSetting = await Setting.findOne({ where: { key: settingKey } });
    const defaultFeePercentage = defaultFeeSetting ? defaultFeeSetting.value : 8.0; // Fallback to 8% if setting not found

    if (sellerFeePercentage === null || sellerFeePercentage === undefined) {
      sellerFeePercentage = defaultFeePercentage;
    }

    // 1. Contar anúncios ativos
    const activeListingsCount = await Listing.count({ where: { sellerId } });

    // 2. Calcular m?tricas de vendas (Total Vendido e Itens Vendidos)
    const orders = await Order.findAll({ order: [['createdAt', 'DESC']] });
    const sellerOrders = orders.filter(order =>
      (order.items || []).some(item => sellerItemMatches(item, sellerId))
    );

    let totalRevenue = 0;
    let totalItemsSold = 0;
    sellerOrders.forEach(order => {
      (order.items || []).forEach(item => {
        if (!sellerItemMatches(item, sellerId)) return;
        totalRevenue += Number(item.price || 0) * Number(item.quantity || 0);
        totalItemsSold += Number(item.quantity || 0);
      });
    });

    const paidStatuses = ['Paid', 'Processing', 'Shipped', 'Delivered'];
    let totalPaidRevenue = 0;
    let totalPaidItemsSold = 0;
    sellerOrders
      .filter(order => paidStatuses.includes(order.status))
      .forEach(order => {
        (order.items || []).forEach(item => {
          if (!sellerItemMatches(item, sellerId)) return;
          totalPaidRevenue += Number(item.price || 0) * Number(item.quantity || 0);
          totalPaidItemsSold += Number(item.quantity || 0);
        });
      });

    // Calculate sales comparison for the last 7 days vs previous 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(today.getDate() - 14);

    const salesLast7Days = await getSalesTotalForPeriod(sellerId, sevenDaysAgo, today);
    const salesPrevious7Days = await getSalesTotalForPeriod(sellerId, fourteenDaysAgo, sevenDaysAgo);

    let salesComparisonPercentage = 0;
    if (salesPrevious7Days > 0) {
      salesComparisonPercentage = ((salesLast7Days - salesPrevious7Days) / salesPrevious7Days) * 100;
    } else if (salesLast7Days > 0) {
      salesComparisonPercentage = 100; // Infinite growth if previous was 0 and current is > 0
    }

    // 3. Buscar as ?ltimas 5 vendas
    const sellerRecentSales = sellerOrders
      .slice(0, 5)
      .map(order => filterOrderItemsForSeller(order, sellerId));

    // Fetch sales data for chart (default to 7 days)
    const salesChartData = await getSalesData(sellerId, '7days');

    // Fetch 'Next Actions' data
    const pendingLabelGeneration = sellerOrders.filter(order =>
      order.status === 'Paid' && !order.melhorEnvioLabelUrl
    ).length;

    const awaitingShipment = sellerOrders.filter(order =>
      order.status === 'Processing' && order.melhorEnvioLabelUrl && !order.trackingCode
    ).length;

    const awaitingConfirmation = sellerOrders.filter(order =>
      order.status === 'Shipped'
    ).length;
    res.render('pages/seller-dashboard', {
      stats: {
        totalRevenue,
        totalItemsSold,
        totalPaidRevenue,
        totalPaidItemsSold,
        activeListingsCount,
        sellerFeePercentage,
        defaultFeePercentage,
        salesComparisonPercentage: salesComparisonPercentage.toFixed(2),
      },
      recentSales: sellerRecentSales,
      salesChartData: JSON.stringify(salesChartData), // Pass as JSON string
      nextActions: {
        pendingLabelGeneration,
        awaitingShipment,
        awaitingConfirmation,
      },
    });

  } catch (error) {
    console.error('Erro ao carregar o dashboard do vendedor:', error);
    res.status(500).send('Erro no servidor');
  }
};



const showSoldOrders = async (req, res) => {
  try {
    const sellerId = req.session.user.id;

    const orders = await Order.findAll({
      include: [{ model: User, as: 'user' }],
      order: [['createdAt', 'DESC']]
    });

    const sellerOrders = orders
      .filter(order => (order.items || []).some(item => sellerItemMatches(item, sellerId)))
      .map(order => filterOrderItemsForSeller(order, sellerId));

    res.render('pages/my-sold-orders', { orders: sellerOrders });

  } catch (error) {
    console.error('Erro ao carregar os pedidos vendidos:', error);
    res.status(500).send('Erro no servidor');
  }
};

const markAsShipped = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { trackingCode } = req.body;
    const sellerId = req.session.user.id;

    // Nível 1: Validação do formato do código de rastreio (padrão Correios)
    const trackingCodeRegex = /^[A-Z]{2}\d{9}BR$/i;
    if (!trackingCode || !trackingCodeRegex.test(trackingCode)) {
      return res.status(400).json({ message: 'Formato de código de rastreio inválido. O formato deve ser XX123456789BR.' });
    }

    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    if (order.status !== 'Paid') {
      return res.status(400).json({ message: 'Este pedido não pode ser marcado como enviado. O status deve ser \'Pago\'.' });
    }

    const isSellerOfItem = order.items.some(item => item.seller.toString() === sellerId);

    if (!isSellerOfItem) {
      return res.status(403).json({ message: 'Você não tem permissão para atualizar este pedido.' });
    }

    order.status = 'Shipped';
    order.trackingCode = trackingCode;
    await order.save();

    // Notificar comprador que pedido foi enviado
    await notificationService.notifyOrderStatus(order.userId, order.id, 'Shipped');
    if (order.user && order.user.email) {
      await sendOrderStatusEmail(order.user.email, order.id, 'Shipped', { name: order.user.fullName || order.user.username });
    }

    res.status(200).json({ message: 'Pedido marcado como enviado com sucesso.' });

  } catch (error) {
    console.error('Erro ao marcar pedido como enviado:', error);
    res.status(500).send('Erro no servidor');
  }
};

const generateMelhorEnvioLabel = async (req, res) => {
  try {
    const { orderId } = req.params;
    const sellerId = req.session.user.id;

    // 1. Fetch all necessary data
    const order = await Order.findByPk(orderId, {
      include: [{ model: User, as: 'user' }]
    }); // Populate buyer info
    const seller = await User.findByPk(sellerId);

    if (!order || !seller) {
      return res.status(404).json({ message: 'Pedido ou vendedor não encontrado.' });
    }

    // Security check: Ensure the user requesting is a seller for an item in this order
    const sellerItems = order.items.filter(item => item.seller.toString() === sellerId);
    if (sellerItems.length === 0) {
      return res.status(403).json({ message: 'Você não tem permissão para gerar etiqueta para este pedido.' });
    }
    
    // Check if label already exists
    if (order.melhorEnvioLabelUrl) {
      return res.status(200).json({ message: 'Etiqueta já gerada.', labelUrl: order.melhorEnvioLabelUrl });
    }

    // **New**: Check if order status is 'Paid'
    if (order.status !== 'Paid') {
      return res.status(400).json({ message: 'A etiqueta só pode ser gerada para pedidos com status \'Pago\'.' });
    }

    // 2. Prepare data for Melhor Envio API
    const sellerAddress = seller.address;
    const buyerAddress = order.shippingAddress;
    const buyerInfo = order.user;

    // Find the shipping service selected for this seller
    const shippingSelection = order.shippingSelections.find(sel => sel.sellerId.toString() === sellerId);
    if (!shippingSelection) {
      return res.status(400).json({ message: 'Opção de frete não encontrada para este vendedor.' });
    }
    const serviceId = shippingSelection.service;

    // Map seller items to Melhor Envio products format
    const products = sellerItems.map(item => ({
      name: item.cardName,
      quantity: item.quantity,
      unitary_value: item.price,
    }));

    // Calculate total weight and insurance value
    const totalWeight = sellerItems.reduce((acc, item) => acc + (item.quantity * 0.01), 0.1); // 10g per card + 100g box
    const insuranceValue = sellerItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    // 3. Construct the payload for addItemToCart
    const shipmentDetails = {
      service: serviceId,
      from: {
        name: seller.businessName || seller.fullName,
        phone: seller.phone,
        email: seller.email,
        document: seller.documentNumber,
        postal_code: sellerAddress.cep,
        address: sellerAddress.street,
        number: sellerAddress.number,
        complement: sellerAddress.complement,
        district: sellerAddress.neighborhood,
        city: sellerAddress.city,
        state_abbr: sellerAddress.state,
        country_id: 'BR',
      },
      to: {
        name: buyerInfo.fullName,
        phone: buyerInfo.phone,
        email: buyerInfo.email,
        postal_code: buyerAddress.cep,
        address: buyerAddress.street,
        number: buyerAddress.number,
        complement: buyerAddress.complement,
        district: buyerAddress.neighborhood,
        city: buyerAddress.city,
        state_abbr: buyerAddress.state,
        country_id: 'BR',
      },
      products,
      package: {
        weight: totalWeight,
        width: 15, // Default dimensions in cm
        height: 5,
        length: 20,
      },
      options: {
        insurance_value: insuranceValue,
        receipt: false,
        own_hand: false,
        reverse: false,
        non_commercial: true, // Assuming sales between individuals/small shops
      },
    };

    // 4. Call Melhor Envio API
    // Step A: Add to cart
    const cartAddResponse = await melhorEnvioClient.addItemToCart(shipmentDetails);
    if (!cartAddResponse || !cartAddResponse.id) {
      throw new Error('Falha ao adicionar o envio ao carrinho do Melhor Envio.');
    }
    const shipmentId = cartAddResponse.id;

    // Step B: Checkout (purchase the label)
    await melhorEnvioClient.purchaseShipments([shipmentId]);

    // Step C: Generate the print URL
    const printResponse = await melhorEnvioClient.printLabels([shipmentId]);
    if (!printResponse || !printResponse.url) {
      throw new Error('Falha ao gerar a URL de impressão da etiqueta.');
    }
    const labelUrl = printResponse.url;

    // 5. Save the label URL and tracking info to the order
    order.melhorEnvioShipmentId = shipmentId;
    order.melhorEnvioLabelUrl = labelUrl;
    order.trackingCode = cartAddResponse.tracking; // The tracking code is available after adding to cart
    order.status = 'Processing'; // **New**: Update status to Processing
    await order.save();

    // 6. Return success response
    res.status(200).json({
      message: 'Etiqueta gerada com sucesso!',
      labelUrl: labelUrl,
    });

  } catch (error) {
    console.error('Erro ao gerar etiqueta do Melhor Envio:', error);
    res.status(500).json({ message: 'Erro interno ao gerar etiqueta.', error: error.message });
  }
};

const getSellerPage = async (req, res) => {
  try {
    const sellerId = req.params.id;

    // Buscar vendedor e seus anúncios em paralelo
    const [seller, listings] = await Promise.all([
      User.findByPk(sellerId),
      Listing.findAll({
        where: { sellerId },
        include: [{ model: Card, as: 'card' }]
      })
    ]);

    if (!seller) {
      return res.status(404).render('pages/404'); // Renderiza uma página 404 se o vendedor não for encontrado
    }

    res.render('pages/seller-page', {
      seller: toPlainWithId(seller),
      listings: listings.map(listing => {
        const data = toPlainWithId(listing);
        if (data.card) data.card = addIdAlias(data.card);
        return data;
      }),
      page_name: 'seller-page' // Para CSS ou JS específico se necessário
    });

  } catch (error) {
    console.error('Erro ao carregar a página do vendedor:', error);
    res.status(500).send('Erro no servidor');
  }
};

module.exports = {
  getSalesData,
  showSellerDashboard,
  showSoldOrders,
  markAsShipped,
  generateMelhorEnvioLabel,
  getSellerPage,
};
