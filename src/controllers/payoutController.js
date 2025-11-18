// src/controllers/payoutController.js

const Payout = require('../models/Payout');
const Order = require('../models/Order');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * GET /seller/payouts
 * Página de repasses do vendedor
 */
async function getSellerPayouts(req, res) {
  try {
    const sellerId = req.session.user.id;
    const seller = await User.findById(sellerId);
    
    const payouts = await Payout.find({ seller: sellerId })
      .sort({ createdAt: -1 })
      .limit(50);

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

    const payout = await Payout.findOne({ _id: id, seller: sellerId })
      .populate('orders.orderId');

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
  try {
    const sellerId = req.session.user.id;
    const seller = await User.findById(sellerId);

    // Verificar se tem dados bancários configurados
    if (!seller.bankInfo?.pixKey && !seller.bankInfo?.accountNumber) {
      return res.status(400).json({
        ok: false,
        error: 'Configure seus dados bancários antes de solicitar um repasse'
      });
    }

    // Verificar saldo disponível
    if (seller.balance.available < seller.payoutSettings.minimumAmount) {
      return res.status(400).json({
        ok: false,
        error: `Saldo mínimo de R$ ${seller.payoutSettings.minimumAmount.toFixed(2)} não atingido`
      });
    }

    // Buscar pedidos entregues que ainda não foram incluídos em um repasse
    const eligibleOrders = await Order.find({
      'items.seller': sellerId,
      status: 'Delivered',
      'items.includedInPayout': { $ne: true }
    });

    if (eligibleOrders.length === 0) {
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
      eligibleOrders.map(o => o._id),
      thirtyDaysAgo,
      now
    );

    // Agendar para processamento
    payout.status = 'Scheduled';
    payout.scheduledDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // +2 dias
    await payout.save();

    // Atualizar saldo do vendedor
    seller.balance.available -= payout.amount;
    seller.balance.pending += payout.amount;
    await seller.save();

    // Marcar items como incluídos no repasse
    for (const order of eligibleOrders) {
      order.items.forEach(item => {
        if (item.seller.toString() === sellerId.toString()) {
          item.includedInPayout = true;
          item.payoutId = payout._id;
        }
      });
      await order.save();
    }

    logger.info(`[payouts] Repasse ${payout._id} criado para vendedor ${sellerId} no valor de R$ ${payout.amount}`);

    res.json({ ok: true, payoutId: payout._id, amount: payout.amount });

  } catch (error) {
    logger.error('[payouts] Erro ao solicitar repasse:', error);
    res.status(500).json({ ok: false, error: 'Erro ao processar solicitação' });
  }
}

/**
 * POST /admin/payouts/:id/approve
 * Aprovar e processar um repasse (Admin)
 */
async function approvePayout(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.session.user.id;

    const payout = await Payout.findById(id).populate('seller');
    
    if (!payout) {
      return res.status(404).json({ ok: false, error: 'Repasse não encontrado' });
    }

    if (payout.status !== 'Scheduled' && payout.status !== 'Pending') {
      return res.status(400).json({ 
        ok: false, 
        error: `Repasse não pode ser aprovado no status ${payout.status}` 
      });
    }

    // TODO: Integrar com gateway de pagamento real
    // Exemplo com PIX via Mercado Pago, Asaas, ou outro provedor
    
    payout.status = 'Processing';
    payout.lastModifiedBy = adminId;
    await payout.save();

    // Simular processamento (remover em produção)
    // Em produção, isso seria feito por um webhook do provedor de pagamento
    setTimeout(async () => {
      try {
        payout.status = 'Completed';
        payout.completedDate = new Date();
        payout.externalTransactionId = `MOCK_${Date.now()}`;
        await payout.save();

        // Atualizar saldo do vendedor
        const seller = await User.findById(payout.seller);
        seller.balance.pending -= payout.amount;
        seller.balance.lifetime += payout.amount;
        await seller.save();

        logger.info(`[payouts] Repasse ${payout._id} concluído com sucesso`);
      } catch (err) {
        logger.error('[payouts] Erro ao finalizar repasse:', err);
      }
    }, 5000);

    res.json({ ok: true, message: 'Repasse em processamento' });

  } catch (error) {
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
    if (seller) filter.seller = seller;

    const payouts = await Payout.find(filter)
      .populate('seller', 'username email businessName')
      .sort({ createdAt: -1 })
      .limit(100);

    // Estatísticas
    const stats = await Payout.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      }
    ]);

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
  try {
    logger.info('[payouts] Iniciando processamento automático de repasses');

    // Buscar vendedores com auto-payout ativado
    const sellers = await User.find({
      'payoutSettings.autoPayoutEnabled': true,
      'balance.available': { $gte: 50 } // Valor mínimo padrão
    });

    for (const seller of sellers) {
      try {
        // Verificar se atingiu o valor mínimo
        if (seller.balance.available < seller.payoutSettings.minimumAmount) {
          continue;
        }

        // Buscar pedidos elegíveis
        const eligibleOrders = await Order.find({
          'items.seller': seller._id,
          status: 'Delivered',
          'items.includedInPayout': { $ne: true }
        });

        if (eligibleOrders.length === 0) continue;

        // Criar repasse
        const now = new Date();
        const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const payout = await Payout.createFromOrders(
          seller._id,
          eligibleOrders.map(o => o._id),
          periodStart,
          now
        );

        payout.status = 'Scheduled';
        payout.scheduledDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        await payout.save();

        // Atualizar saldo
        seller.balance.available -= payout.amount;
        seller.balance.pending += payout.amount;
        await seller.save();

        // Marcar items
        for (const order of eligibleOrders) {
          order.items.forEach(item => {
            if (item.seller.toString() === seller._id.toString()) {
              item.includedInPayout = true;
              item.payoutId = payout._id;
            }
          });
          await order.save();
        }

        logger.info(`[payouts] Repasse automático ${payout._id} criado para ${seller.username}`);

      } catch (error) {
        logger.error(`[payouts] Erro ao processar repasse para ${seller.username}:`, error);
      }
    }

    logger.info('[payouts] Processamento automático concluído');

  } catch (error) {
    logger.error('[payouts] Erro no processamento automático:', error);
  }
}

module.exports = {
  getSellerPayouts,
  getPayoutDetails,
  requestPayout,
  approvePayout,
  getAdminPayouts,
  processAutomaticPayouts
};
