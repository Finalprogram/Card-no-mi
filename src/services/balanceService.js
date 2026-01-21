// src/services/balanceService.js

const User = require('../models/User');
const Order = require('../models/Order');
const logger = require('../config/logger');

/**
 * Atualiza o saldo do vendedor quando um pedido muda de status
 * @param {String} orderId - ID do pedido
 */
async function updateSellerBalancesForOrder(orderId) {
  try {
    const order = await Order.findByPk(orderId);
    
    if (!order) {
      logger.error(`[balance] Pedido ${orderId} não encontrado`);
      return;
    }

    // Agrupar items por vendedor
    const sellerMap = new Map();
    
    for (const item of order.items) {
      const sellerId = item.seller.toString();
      
      if (!sellerMap.has(sellerId)) {
        sellerMap.set(sellerId, {
          seller: item.seller,
          totalNet: 0,
          items: []
        });
      }
      
      const sellerData = sellerMap.get(sellerId);
      sellerData.totalNet += item.sellerNet;
      sellerData.items.push(item);
    }

    // Atualizar saldo de cada vendedor
    for (const [sellerId, data] of sellerMap) {
      const seller = await User.findByPk(sellerId);
      
      if (!seller) {
        logger.warn(`[balance] Vendedor ${sellerId} não encontrado`);
        continue;
      }

      // Lógica baseada no status do pedido
      switch (order.status) {
        case 'Paid':
        case 'Processing':
          // Quando o pedido é pago, o valor vai para "pending"
          seller.balance.pending += data.totalNet;
          logger.info(`[balance] Adicionado R$ ${data.totalNet.toFixed(2)} ao saldo pendente de ${seller.username}`);
          break;

        case 'Delivered':
          // Quando entregue, move de "pending" para "available"
          // Mas só se ainda não foi movido antes
          const alreadyProcessed = data.items.every(item => item.balanceProcessed);
          
          if (!alreadyProcessed) {
            seller.balance.pending -= data.totalNet;
            seller.balance.available += data.totalNet;
            
            // Marcar items como processados
            for (const item of data.items) {
              item.balanceProcessed = true;
            }
            await order.save();
            
            logger.info(`[balance] Movido R$ ${data.totalNet.toFixed(2)} para saldo disponível de ${seller.username}`);
          }
          break;

        case 'Cancelled':
          // Se cancelado antes da entrega, remove do pending
          const wasPending = data.items.some(item => item.balanceProcessed === false);
          
          if (wasPending) {
            seller.balance.pending -= data.totalNet;
            logger.info(`[balance] Removido R$ ${data.totalNet.toFixed(2)} do saldo pendente de ${seller.username} (cancelamento)`);
          }
          break;
      }

      await seller.save();
    }

  } catch (error) {
    logger.error(`[balance] Erro ao atualizar saldo para pedido ${orderId}:`, error);
  }
}

/**
 * Recalcula todo o saldo de um vendedor baseado nos pedidos
 * Útil para correções ou auditorias
 * @param {String} sellerId - ID do vendedor
 */
async function recalculateSellerBalance(sellerId) {
  try {
    const seller = await User.findByPk(sellerId);
    
    if (!seller) {
      throw new Error(`Vendedor ${sellerId} não encontrado`);
    }

    // Buscar todos os pedidos do vendedor
    const orders = await Order.findAll();

    let pending = 0;
    let available = 0;
    let frozen = 0;
    let lifetime = 0;

    for (const order of orders) {
      const sellerItems = order.items.filter(
        item => item.seller.toString() === sellerId.toString()
      );

      const orderTotal = sellerItems.reduce((sum, item) => sum + item.sellerNet, 0);

      switch (order.status) {
        case 'Paid':
        case 'Processing':
        case 'Shipped':
          pending += orderTotal;
          break;

        case 'Delivered':
          // Só conta como available se não está em um payout
          if (!sellerItems.some(item => item.includedInPayout)) {
            available += orderTotal;
          }
          lifetime += orderTotal;
          break;

        case 'OnHold': // Status customizado para problemas
          frozen += orderTotal;
          break;
      }
    }

    // Atualizar saldo
    seller.balance = {
      available,
      pending,
      frozen,
      lifetime
    };

    await seller.save();

    logger.info(`[balance] Saldo recalculado para ${seller.username}: Available: R$ ${available.toFixed(2)}, Pending: R$ ${pending.toFixed(2)}, Lifetime: R$ ${lifetime.toFixed(2)}`);

    return seller.balance;

  } catch (error) {
    logger.error(`[balance] Erro ao recalcular saldo do vendedor ${sellerId}:`, error);
    throw error;
  }
}

/**
 * Obtém resumo financeiro de um vendedor
 * @param {String} sellerId - ID do vendedor
 */
async function getSellerFinancialSummary(sellerId) {
  try {
    const seller = await User.findByPk(sellerId);
    
    if (!seller) {
      throw new Error(`Vendedor ${sellerId} não encontrado`);
    }

    // Buscar estatísticas de pedidos
    const orders = await Order.findAll();
    const orderStatsMap = new Map();

    orders.forEach(order => {
      const sellerItems = (order.items || []).filter(item => item.seller.toString() === sellerId.toString());
      if (!sellerItems.length) return;

      const status = order.status || 'Unknown';
      const entry = orderStatsMap.get(status) || {
        _id: status,
        count: 0,
        totalNet: 0,
        totalGross: 0,
        totalFee: 0
      };

      sellerItems.forEach(item => {
        entry.count += 1;
        entry.totalNet += Number(item.sellerNet || 0);
        entry.totalGross += Number(item.price || 0) * Number(item.quantity || 0);
        entry.totalFee += Number(item.marketplaceFee || 0);
      });

      orderStatsMap.set(status, entry);
    });

    const orderStats = Array.from(orderStatsMap.values());

    // Buscar payouts
    const Payout = require('../models/Payout');
    const payouts = await Payout.findAll({ where: { sellerId } });
    const payoutStatsMap = new Map();

    payouts.forEach(payout => {
      const status = payout.status || 'Unknown';
      const entry = payoutStatsMap.get(status) || { _id: status, count: 0, total: 0 };
      entry.count += 1;
      entry.total += Number(payout.amount || 0);
      payoutStatsMap.set(status, entry);
    });

    const payoutStats = Array.from(payoutStatsMap.values());

    return {
      balance: seller.balance,
      orderStats,
      payoutStats,
      bankConfigured: !!(seller.bankInfo?.pixKey || seller.bankInfo?.accountNumber),
      payoutSettings: seller.payoutSettings
    };

  } catch (error) {
    logger.error(`[balance] Erro ao obter resumo financeiro do vendedor ${sellerId}:`, error);
    throw error;
  }
}

module.exports = {
  updateSellerBalancesForOrder,
  recalculateSellerBalance,
  getSellerFinancialSummary
};
