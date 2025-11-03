// src/controllers/sellerController.js
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Setting = require('../models/Setting');
const melhorEnvioClient = require('../services/melhorEnvioClient'); // Importar o cliente do Melhor Envio
const emailService = require('../services/emailService'); // Importar o serviço de e-mail

const showSellerDashboard = async (req, res) => {
  try {
    const sellerObjectId = new mongoose.Types.ObjectId(req.session.user.id);
    const seller = await User.findById(sellerObjectId); // Fetch seller user object

    if (!seller) {
      return res.status(404).send('Vendedor não encontrado.');
    }

    // Calculate seller's fee percentage
    let sellerFeePercentage = seller.fee_override_percentage;
    if (sellerFeePercentage === null || sellerFeePercentage === undefined) {
      const settingKey = `fee_${seller.accountType}_percentage`;
      const defaultFeeSetting = await Setting.findOne({ key: settingKey });
      sellerFeePercentage = defaultFeeSetting ? defaultFeeSetting.value : 0; // Fallback to 0 if setting not found
    }

    // 1. Contar anúncios ativos
    const activeListingsCount = await Listing.countDocuments({ seller: sellerObjectId });

    // 2. Calcular métricas de vendas (Total Vendido e Itens Vendidos)
    const salesData = await Order.aggregate([
      // Encontra todos os pedidos que contenham pelo menos um item do vendedor
      { $match: { 'items.seller': sellerObjectId } },
      // "Desenrola" o array de itens, criando um documento para cada item
      { $unwind: '$items' },
      // Filtra novamente para manter apenas os itens do vendedor atual
      { $match: { 'items.seller': sellerObjectId } },
      // Agrupa os resultados para calcular a soma e a contagem
      {
        $group: {
          _id: null, // Agrupa todos os itens do vendedor em um único resultado
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          totalItemsSold: { $sum: '$items.quantity' }
        }
      }
    ]);

    // O aggregate agora retorna um único objeto com os totais, ou um array vazio se não houver vendas
    const totalRevenue = salesData.length > 0 ? salesData[0].totalRevenue : 0;
    const totalItemsSold = salesData.length > 0 ? salesData[0].totalItemsSold : 0;

    // 3. Buscar as últimas 5 vendas
    const recentSales = await Order.find({ 'items.seller': sellerObjectId })
      .sort({ createdAt: -1 })
      .limit(5);

    // Filtra os itens para mostrar apenas os do vendedor
    const sellerRecentSales = recentSales.map(order => {
        return {
            ...order.toObject(),
            items: order.items.filter(item => item.seller.toString() === sellerObjectId.toString())
        };
    });

    res.render('pages/seller-dashboard', {
      stats: {
        totalRevenue,
        totalItemsSold,
        activeListingsCount,
      },
      recentSales: sellerRecentSales,
    });

  } catch (error) {
    console.error('Erro ao carregar o dashboard do vendedor:', error);
    res.status(500).send('Erro no servidor');
  }
};

const showSoldOrders = async (req, res) => {
  try {
    const sellerObjectId = new mongoose.Types.ObjectId(req.session.user.id);

    const orders = await Order.find({ 'items.seller': sellerObjectId })
      .sort({ createdAt: -1 })
      .populate('user'); // Popula os dados do comprador

    const sellerOrders = orders.map(order => {
      return {
        ...order.toObject(),
        items: order.items.filter(item => item.seller.toString() === sellerObjectId.toString())
      };
    });

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

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    if (order.status !== 'Processing' && order.status !== 'Paid') {
      return res.status(400).json({ message: 'Este pedido não pode ser marcado como enviado. O status deve ser \'Processando\' ou \'Pago\'.' });
    }

    const isSellerOfItem = order.items.some(item => item.seller.toString() === sellerId);

    if (!isSellerOfItem) {
      return res.status(403).json({ message: 'Você não tem permissão para atualizar este pedido.' });
    }

    order.status = 'Shipped';
    order.trackingCode = trackingCode;
    await order.save();

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
    const order = await Order.findById(orderId).populate('user'); // Populate buyer info
    const seller = await User.findById(sellerId);

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

module.exports = {
  showSellerDashboard,
  showSoldOrders,
  markAsShipped,
  generateMelhorEnvioLabel,
};
