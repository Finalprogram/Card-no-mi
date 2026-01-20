// src/controllers/payoutController.js

const Payout = require('../models/Payout');
const Order = require('../models/Order');
const User = require('../models/User');
const logger = require('../config/logger');
const { sequelize } = require('../database/connection');

/**
 * GET /seller/payouts
 * Página de repasses do vendedor
 */
async function getSellerPayouts(req, res) {
  try {
    const sellerId = req.session.user.id;
    const seller = await User.findByPk(sellerId);
    
    const payouts = await Payout.findAll({ 
      where: { sellerId: sellerId },
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    // Calcular saldo disponível
    const balance = seller.balance || {
      available: 0,
      pending: 0,
      frozen: 0,
      lifetime: 0
    };

    res.render('pages/seller-payouts', {
      payouts,
      balance,
      seller,
      bankConfigured: !!(seller.bankInfo?.pixKey || seller.bankInfo?.accountNumber)
    });
  } catch (error) {
    logger.error('[payouts] Erro ao buscar repasses:', error);
    res.status(500).send('Erro ao carregar repasses');
  }
}

/**
 * GET /seller/payouts/:id
 * Detalhes de um repasse específico
 */
async function getPayoutDetails(req, res) {
  try {
    const { id } = req.params;
    const sellerId = req.session.user.id;

    const payout = await Payout.findOne({ 
      where: { id: id, sellerId: sellerId },
      include: [{ model: Order, as: 'orders' }]
    });

    if (!payout) {
      return res.status(404).send('Repasse não encontrado');
    }

    res.render('pages/payout-details', { payout });
  } catch (error) {
    logger.error('[payouts] Erro ao buscar detalhes do repasse:', error);
    res.status(500).send('Erro ao carregar detalhes');
  }
}

/**
 * POST /seller/payouts/request
 * Solicitar um novo repasse (on-demand)
 */
async function requestPayout(req, res) {
  const t = await sequelize.transaction();
  try {
    const sellerId = req.session.user.id;
    const seller = await User.findByPk(sellerId, { transaction: t });

    // Verificar se tem dados bancários configurados
    if (!seller.bankInfo?.pixKey && !seller.bankInfo?.accountNumber) {
      await t.rollback();
      return res.status(400).json({
        ok: false,
        error: 'Configure seus dados bancários antes de solicitar um repasse'
      });
    }

    // Verificar saldo disponível
    if (seller.balance.available < seller.payoutSettings.minimumAmount) {
      await t.rollback();
      return res.status(400).json({
        ok: false,
        error: `Saldo mínimo de R$ ${seller.payoutSettings.minimumAmount.toFixed(2)} não atingido`
      });
    }

    // Buscar pedidos entregues que ainda não foram incluídos em um repasse
    const eligibleOrders = await Order.findAll({
      where: {
        status: 'Delivered',
        // This is tricky. We need to check a value in a JSON array.
        // This might require a raw query depending on the database.
        // For now, we'll assume a simple check works, but this may need revision.
      },
      transaction: t
    });
    
    const sellerEligibleOrders = eligibleOrders.filter(o => o.items.some(i => i.sellerId === sellerId && !i.includedInPayout));


    if (sellerEligibleOrders.length === 0) {
      await t.rollback();
      return res.status(400).json({
        ok: false,
        error: 'Nenhum pedido elegível para repasse no momento'
      });
    }

    // Criar o repasse
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const payout = await Payout.createFromOrders(
      sellerId,
      sellerEligibleOrders.map(o => o.id),
      thirtyDaysAgo,
      now,
      { transaction: t }
    );

    // Agendar para processamento
    payout.status = 'Scheduled';
    payout.scheduledDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // +2 dias
    await payout.save({ transaction: t });

    // Atualizar saldo do vendedor
    const newAvailable = seller.balance.available - payout.amount;
    const newPending = seller.balance.pending + payout.amount;
    
    await seller.update({ 
        balance: { ...seller.balance, available: newAvailable, pending: newPending }
    }, { transaction: t });


    // Marcar items como incluídos no repasse
    for (const order of sellerEligibleOrders) {
        const updatedItems = order.items.map(item => {
            if (item.sellerId === sellerId) {
                return { ...item, includedInPayout: true, payoutId: payout.id };
            }
            return item;
        });
        await order.update({ items: updatedItems }, { transaction: t });
    }

    logger.info(`[payouts] Repasse ${payout.id} criado para vendedor ${sellerId} no valor de R$ ${payout.amount}`);
    
    await t.commit();

    res.json({ ok: true, payoutId: payout.id, amount: payout.amount });

  } catch (error) {
    await t.rollback();
    logger.error('[payouts] Erro ao solicitar repasse:', error);
    res.status(500).json({ ok: false, error: 'Erro ao processar solicitação' });
  }
}

/**
 * POST /admin/payouts/:id/approve
 * Aprovar e processar um repasse (Admin)
 */
async function approvePayout(req, res) {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const adminId = req.session.user.id;

    const payout = await Payout.findByPk(id, { include: 'seller', transaction: t });
    
    if (!payout) {
      await t.rollback();
      return res.status(404).json({ ok: false, error: 'Repasse não encontrado' });
    }

    if (payout.status !== 'Scheduled' && payout.status !== 'Pending') {
      await t.rollback();
      return res.status(400).json({ 
        ok: false, 
        error: `Repasse não pode ser aprovado no status ${payout.status}` 
      });
    }

    // TODO: Integrar com gateway de pagamento real
    
    payout.status = 'Processing';
    await payout.save({ transaction: t, userId: adminId });

    // Simular processamento
    setTimeout(async () => {
      const innerTransaction = await sequelize.transaction();
      try {
        const payoutToComplete = await Payout.findByPk(id, { transaction: innerTransaction });
        payoutToComplete.status = 'Completed';
        payoutToComplete.completedDate = new Date();
        payoutToComplete.externalTransactionId = `MOCK_${Date.now()}`;
        await payoutToComplete.save({ transaction: innerTransaction });

        const seller = await User.findByPk(payoutToComplete.sellerId, { transaction: innerTransaction });
        const newPending = seller.balance.pending - payoutToComplete.amount;
        const newLifetime = seller.balance.lifetime + payoutToComplete.amount;
        await seller.update({ 
            balance: { ...seller.balance, pending: newPending, lifetime: newLifetime }
        }, { transaction: innerTransaction });

        await innerTransaction.commit();
        logger.info(`[payouts] Repasse ${payoutToComplete.id} concluído com sucesso`);
      } catch (err) {
        await innerTransaction.rollback();
        logger.error('[payouts] Erro ao finalizar repasse:', err);
      }
    }, 5000);

    await t.commit();
    res.json({ ok: true, message: 'Repasse em processamento' });

  } catch (error) {
    await t.rollback();
    logger.error('[payouts] Erro ao aprovar repasse:', error);
    res.status(500).json({ ok: false, error: 'Erro ao processar aprovação' });
  }
}

/**
 * GET /admin/payouts
 * Painel administrativo de repasses
 */
async function getAdminPayouts(req, res) {
  try {
    const { status, seller } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (seller) filter.sellerId = seller;

    const payouts = await Payout.findAll({
      where: filter,
      include: [{ model: User, as: 'seller', attributes: ['username', 'email', 'businessName'] }],
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    // Estatísticas
    const stats = await Payout.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total']
      ],
      group: ['status']
    });

    res.render('pages/admin-payouts', { payouts, stats });

  } catch (error) {
    logger.error('[payouts] Erro ao buscar repasses (admin):', error);
    res.status(500).send('Erro ao carregar painel');
  }
}

/**
 * Função auxiliar para processar repasses automáticos
 * Deve ser chamada por um cron job diariamente
 */
async function processAutomaticPayouts() {
  logger.info('[payouts] Iniciando processamento automático de repasses');
  const sellers = await User.findAll({
    where: {
      'payoutSettings.autoPayoutEnabled': true,
      'balance.available': { [sequelize.Op.gte]: 50 }
    }
  });

  for (const seller of sellers) {
    const t = await sequelize.transaction();
    try {
      if (seller.balance.available < seller.payoutSettings.minimumAmount) {
        await t.rollback();
        continue;
      }

      const eligibleOrders = await Order.findAll({
        where: {
          status: 'Delivered',
        },
        transaction: t
      });
      
      const sellerEligibleOrders = eligibleOrders.filter(o => o.items.some(i => i.sellerId === seller.id && !i.includedInPayout));

      if (sellerEligibleOrders.length === 0) {
        await t.rollback();
        continue;
      }

      const now = new Date();
      const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const payout = await Payout.createFromOrders(
        seller.id,
        sellerEligibleOrders.map(o => o.id),
        periodStart,
        now,
        { transaction: t }
      );

      payout.status = 'Scheduled';
      payout.scheduledDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      await payout.save({ transaction: t });

      const newAvailable = seller.balance.available - payout.amount;
      const newPending = seller.balance.pending + payout.amount;
      await seller.update({ 
          balance: { ...seller.balance, available: newAvailable, pending: newPending }
      }, { transaction: t });

      for (const order of sellerEligibleOrders) {
        const updatedItems = order.items.map(item => {
            if (item.sellerId === seller.id) {
                return { ...item, includedInPayout: true, payoutId: payout.id };
            }
            return item;
        });
        await order.update({ items: updatedItems }, { transaction: t });
      }
      
      await t.commit();
      logger.info(`[payouts] Repasse automático ${payout.id} criado para ${seller.username}`);

    } catch (error) {
      await t.rollback();
      logger.error(`[payouts] Erro ao processar repasse para ${seller.username}:`, error);
    }
  }
  logger.info('[payouts] Processamento automático concluído');
}

module.exports = {
  getSellerPayouts,
  getPayoutDetails,
  requestPayout,
  approvePayout,
  getAdminPayouts,
  processAutomaticPayouts
};
