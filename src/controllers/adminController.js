const { Op } = require('sequelize');
const User = require('../models/User');
const Order = require('../models/Order');
const Listing = require('../models/Listing');
const Setting = require('../models/Setting');
const Coupon = require('../models/Coupon');
const DailyVisitorCount = require('../models/DailyVisitorCount');
const logger = require('../config/logger');

async function showDashboard(req, res) {
  try {
    const totalUsers = await User.count();
    const totalOrders = await Order.count();

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const activeUsers = await User.count({ where: { lastActivityAt: { [Op.gte]: fiveMinutesAgo } } });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const historicalVisitors = await DailyVisitorCount.findAll({
      where: { date: { [Op.gte]: thirtyDaysAgo } },
      order: [['date', 'ASC']]
    });

    const orders = await Order.findAll();
    let totalMarketplaceRevenue = 0;
    orders.forEach(order => {
      if (order.marketplaceFee) {
        totalMarketplaceRevenue += order.marketplaceFee;
      } else if (order.items) {
        order.items.forEach(item => {
          if (item.marketplaceFee) {
            totalMarketplaceRevenue += item.marketplaceFee;
          }
        });
      }
    });

    const pendingFeeOrders = await Order.findAll({
      where: {
        status: { [Op.in]: ['Paid', 'Delivered'] }
      },
      include: [{ model: User, as: 'user' }],
      order: [['createdAt', 'DESC']]
    });

    res.render('admin/dashboard', {
      layout: 'layouts/admin',
      totalUsers,
      totalOrders,
      activeUsers,
      historicalVisitors,
      totalMarketplaceRevenue: totalMarketplaceRevenue.toFixed(2),
      pendingFeeOrders,
      pageTitle: 'Admin Dashboard'
    });
  } catch (error) {
    logger.error('Error showing admin dashboard:', error);
    res.status(500).send('Internal Server Error');
  }
}

async function listUsers(req, res) {
  try {
    const users = await User.findAll({ attributes: { exclude: ['password'] } });
    const defaultFees = {};
    const accountTypes = ['individual', 'shop', 'store', 'partner_store'];
    for (const type of accountTypes) {
      const setting = await Setting.findOne({ where: { key: `fee_${type}_percentage` } });
      defaultFees[type] = setting ? setting.value : 8.0;
    }

    res.render('admin/users', {
      layout: 'layouts/admin',
      users,
      defaultFees,
      pageTitle: 'Manage Users'
    });
  } catch (error) {
    logger.error('Error listing users:', error);
    res.status(500).send('Internal Server Error');
  }
}

async function setFee(req, res) {
  const adminId = req.session.user.id;
  const { id } = req.params;
  const { fee_override_percentage } = req.body;

  try {
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const newFee = fee_override_percentage === 'null' ? null : Number(fee_override_percentage);
    await user.update({ fee_override_percentage: newFee });

    logger.info(`[Admin Action] Admin ID: ${adminId} set custom fee for User ID: ${id} to ${newFee}%.`);
    res.json({ success: true, message: 'Fee updated successfully.' });
  } catch (error) {
    logger.error(`[Admin Action] Error setting fee for User ID: ${id} by Admin ID: ${adminId}. Error:`, error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function showCreateCouponPage(req, res) {
  res.render('admin/create-coupon', {
    layout: 'layouts/admin',
    pageTitle: 'Criar Novo Cupom',
    message: req.session.message,
  });
  delete req.session.message;
}

async function createCoupon(req, res) {
  const adminId = req.session.user.id;
  const { code, discountType, discountValue, expirationDate, usageLimit, minimumOrderAmount } = req.body;

  try {
    if (!code || !discountType || !discountValue || !expirationDate) {
      req.session.message = { type: 'error', text: 'Por favor, preencha todos os campos obrigatórios.' };
      return res.redirect('/admin/coupons/create');
    }

    await Coupon.create({
      code,
      discountType,
      discountValue: Number(discountValue),
      expirationDate: new Date(expirationDate),
      usageLimit: Number(usageLimit) || 1,
      minimumOrderAmount: Number(minimumOrderAmount) || 0,
    });

    logger.info(`[Admin Action] Admin ID: ${adminId} created new coupon. Code: ${code}, Type: ${discountType}, Value: ${discountValue}.`);
    req.session.message = { type: 'success', text: 'Cupom criado com sucesso!' };
    res.redirect('/admin/coupons/create');

  } catch (error) {
    logger.error(`[Admin Action] Error creating coupon by Admin ID: ${adminId}. Error:`, error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      req.session.message = { type: 'error', text: 'Código de cupom já existe. Por favor, escolha outro.' };
    } else {
      req.session.message = { type: 'error', text: 'Erro ao criar cupom.' };
    }
    res.redirect('/admin/coupons/create');
  }
}

async function setDefaultFee(req, res) {
  const adminId = req.session.user.id;
  const { newDefaultFee } = req.body;

  try {
    if (newDefaultFee === undefined || newDefaultFee === null || isNaN(Number(newDefaultFee))) {
      return res.status(400).json({ message: 'Invalid fee value provided.' });
    }

    const feeValue = Number(newDefaultFee);

    await Setting.upsert({ key: 'fee_individual_percentage', value: feeValue, description: `Taxa padrão para vendedores do tipo "individual", em porcentagem.` });
    await Setting.upsert({ key: 'fee_shop_percentage', value: feeValue, description: `Taxa padrão para vendedores do tipo "loja" (shop), em porcentagem.` });

    logger.info(`[Admin Action] Admin ID: ${adminId} set default fee for all seller types to ${feeValue}%.`);
    res.json({ success: true, message: `Default fee updated to ${feeValue}%.` });
  } catch (error) {
    logger.error(`[Admin Action] Error setting default fee by Admin ID: ${adminId}. Error:`, error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = {
  showDashboard,
  listUsers,
  setFee,
  showCreateCouponPage,
  createCoupon,
  setDefaultFee,
};
