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

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).send('Pedido não encontrado.');
    }

    if (order.status !== 'Processing') {
      return res.status(400).send('Este pedido não pode ser marcado como enviado.');
    }

    const isSellerOfItem = order.items.some(item => item.seller.toString() === sellerId);

    if (!isSellerOfItem) {
      return res.status(403).send('Você não tem permissão para atualizar este pedido.');
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

    const order = await Order.findById(orderId).populate('user').populate('items.card');

    if (!order) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    const isSellerOfOrder = order.items.some(item => item.seller.toString() === sellerId);

    if (!isSellerOfOrder) {
      return res.status(403).json({ message: 'Você não tem permissão para gerar etiqueta para este pedido.' });
    }

    // Fetch seller's full details to get address
    const seller = await User.findById(sellerId);
    if (!seller || !seller.address || !seller.address.cep) {
      return res.status(400).json({ message: 'Endereço do vendedor não configurado. Por favor, complete seu perfil.' });
    }

    // Buyer's address is in order.shippingAddress (string), need to parse or ensure it's structured
    // For simplicity, assuming order.shippingAddress is a string that can be used directly or parsed.
    // In a real app, you'd likely store structured address data for the buyer too.
    const buyerAddress = order.shippingAddress; // This needs to be parsed into components for Melhor Envio

    // Placeholder for package details. In a real app, this would come from product data or seller input.
    const pkg = {
      width: 11, // cm
      height: 2, // cm
      length: 16, // cm
      weight: 0.1, // kg (100g)
      insurance_value: order.totals.grand, // Insure for the total value of the order
    };

    // Placeholder for service. In a real app, this might be chosen by the buyer/seller.
    const serviceId = '1'; // Ex: PAC

    // 1. Cotar Frete (opcional, se já não foi feito ou para re-confirmar)
    // const freightQuote = await melhorEnvioClient.cotarFreteMelhorEnvio({
    //   fromPostalCode: seller.address.cep,
    //   toPostalCode: buyerAddress.cep, // Assuming buyerAddress has cep
    //   pkg,
    //   services: serviceId,
    // });
    // logger.info('Cotação de frete:', freightQuote);

    // 2. Adicionar item ao carrinho do Melhor Envio
    // NOTE: The Melhor Envio API expects structured address objects for 'from' and 'to'
    // The 'order.shippingAddress' is currently a string. This needs to be properly structured.
    // For this example, I'll make a simplified assumption or use placeholder structure.
    const shipmentDetails = {
      from: {
        name: seller.fullName || seller.username,
        phone: seller.phone || '99999999999', // Placeholder
        email: seller.email,
        document: seller.document || '00000000000', // Placeholder CPF/CNPJ
        company_document: null,
        state_register: null,
        address: seller.address.street,
        complement: seller.address.complement || '',
        number: seller.address.number || 'SN',
        district: seller.address.district,
        city: seller.address.city,
        state: seller.address.state,
        country_id: 'BR',
        postal_code: seller.address.cep,
      },
      to: {
        name: order.user.fullName || order.user.username,
        phone: order.user.phone || '99999999999', // Placeholder
        email: order.user.email,
        document: order.user.document || '00000000000', // Placeholder CPF/CNPJ
        company_document: null,
        state_register: null,
        address: buyerAddress.split(', ')[0] || 'Rua do Comprador', // Simplified parsing
        complement: '',
        number: buyerAddress.split(', ')[1] || 'SN', // Simplified parsing
        district: 'Bairro do Comprador', // Placeholder
        city: 'Cidade do Comprador', // Placeholder
        state: 'SP', // Placeholder
        country_id: 'BR',
        postal_code: buyerAddress.split('-').pop() || '00000000', // Simplified parsing
      },
      service: serviceId,
      package: pkg,
      options: {
        insurance_value: pkg.insurance_value,
        receipt: false,
        own_hand: false,
      },
    };

    const cartResponse = await melhorEnvioClient.addItemToCart(shipmentDetails);
    const melhorEnvioOrderId = cartResponse.id; // ID do item no carrinho do Melhor Envio

    // 3. Comprar os envios (checkout)
    const purchaseResponse = await melhorEnvioClient.purchaseShipments([melhorEnvioOrderId]);
    logger.info('Resposta de compra do Melhor Envio:', purchaseResponse);

    // 4. Obter links de impressão das etiquetas
    const printResponse = await melhorEnvioClient.printLabels([melhorEnvioOrderId]);
    const labelUrl = printResponse.url; // A URL para o PDF da etiqueta

    // 5. Atualizar o pedido no banco de dados
    order.melhorEnvioShipmentId = melhorEnvioOrderId;
    order.melhorEnvioLabelUrl = labelUrl;
    order.melhorEnvioService = serviceId; // Store the chosen service
    order.status = 'Shipped'; // Optionally change status here or in markAsShipped
    // TODO: Melhor Envio tracking URL might be available in purchaseResponse or printResponse
    await order.save();

    // 6. Enviar e-mail ao vendedor com a etiqueta
    const sellerEmailSubject = `Etiqueta de Envio Gerada para o Pedido #${order._id}`;
    const sellerEmailHtml = `
      <p>Olá ${seller.fullName || seller.username},</p>
      <p>A etiqueta de envio para o seu pedido <strong>#${order._id}</strong> foi gerada com sucesso.</p>
      <p>Você pode baixar a etiqueta aqui: <a href="${labelUrl}">Baixar Etiqueta</a></p>
      <p>Por favor, imprima a etiqueta e prepare o pacote para envio.</p>
      <p>Obrigado!</p>
    `;
    await emailService.sendEmail(seller.email, sellerEmailSubject, sellerEmailHtml);

    res.status(200).json({ message: 'Etiqueta gerada e enviada com sucesso!', labelUrl });

  } catch (error) {
    console.error('Erro ao gerar etiqueta do Melhor Envio:', error);
    res.status(500).json({ message: 'Erro ao gerar etiqueta do Melhor Envio.', error: error.message });
  }
};

module.exports = {
  showSellerDashboard,
  showSoldOrders,
  markAsShipped,
  generateMelhorEnvioLabel,
};
