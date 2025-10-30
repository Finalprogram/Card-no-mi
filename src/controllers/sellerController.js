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

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    const isSellerOfOrder = order.items.some(item => item.seller.toString() === sellerId);

    if (!isSellerOfOrder) {
      return res.status(403).json({ message: 'Você não tem permissão para acessar esta etiqueta.' });
    }

    if (order.melhorEnvioLabelUrl) {
      res.status(200).json({ message: 'Etiqueta disponível.', labelUrl: order.melhorEnvioLabelUrl });
    } else {
      res.status(404).json({ message: 'Etiqueta do Melhor Envio não encontrada para este pedido. Pode não ter sido gerada ou o pagamento ainda está pendente.' });
    }

  } catch (error) {
    console.error('Erro ao buscar etiqueta do Melhor Envio:', error);
    res.status(500).json({ message: 'Erro ao buscar etiqueta do Melhor Envio.', error: error.message });
  }
};

module.exports = {
  showSellerDashboard,
  showSoldOrders,
  markAsShipped,
  generateMelhorEnvioLabel,
};
