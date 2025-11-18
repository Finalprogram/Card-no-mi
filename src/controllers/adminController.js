const User = require('../models/User');
const Order = require('../models/Order');
const Setting = require('../models/Setting');
const Coupon = require('../models/Coupon');
const DailyVisitorCount = require('../models/DailyVisitorCount'); // Import DailyVisitorCount model
const logger = require('../config/logger');

async function showDashboard(req, res) {
  try {
    // Placeholder for dashboard data
    const totalUsers = await User.countDocuments();
    const totalOrders = await Order.countDocuments();

    // Calculate active users (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const activeUsers = await User.countDocuments({ lastActivityAt: { $gte: fiveMinutesAgo } });

    // Fetch historical unique visitor data for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const historicalVisitors = await DailyVisitorCount.find({
      date: { $gte: thirtyDaysAgo }
    }).sort({ date: 1 }); // Sort by date ascending

    // Calculate total marketplace fees (example - needs refinement based on Order model structure)
    // This assumes your Order model stores marketplaceFee per order or per item within an order
    const orders = await Order.find({});
    let totalMarketplaceRevenue = 0;
    orders.forEach(order => {
      // Assuming marketplaceFee is stored directly on the order or can be calculated from items
      // You might need to adjust this based on your actual Order schema
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

    res.render('admin/dashboard', {
      layout: 'layouts/admin', // Assuming an admin layout
      totalUsers,
      totalOrders,
      activeUsers, // Pass active users count to the view
      historicalVisitors, // Pass historical unique visitor data to the view
      totalMarketplaceRevenue: totalMarketplaceRevenue.toFixed(2),
      pageTitle: 'Admin Dashboard'
    });
  } catch (error) {
    logger.error('Error showing admin dashboard:', error);
    res.status(500).send('Internal Server Error');
  }
}

async function listUsers(req, res) {
  try {
    const users = await User.find({}).select('-password'); // Exclude passwords
    const defaultFees = {};
    const accountTypes = ['individual', 'shop'];
    for (const type of accountTypes) {
      const setting = await Setting.findOne({ key: `fee_${type}_percentage` });
      defaultFees[type] = setting ? setting.value : 8.0; // Default to 8% if not set
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
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const newFee = fee_override_percentage === 'null' ? null : Number(fee_override_percentage);
    user.fee_override_percentage = newFee;
    await user.save();

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
    // Basic validation
    if (!code || !discountType || !discountValue || !expirationDate) {
      req.session.message = { type: 'error', text: 'Por favor, preencha todos os campos obrigatórios.' };
      return res.redirect('/admin/coupons/create');
    }

    const newCoupon = new Coupon({
      code,
      discountType,
      discountValue: Number(discountValue),
      expirationDate: new Date(expirationDate),
      usageLimit: Number(usageLimit) || 1,
      minimumOrderAmount: Number(minimumOrderAmount) || 0,
    });

    await newCoupon.save();

    logger.info(`[Admin Action] Admin ID: ${adminId} created new coupon. Code: ${code}, Type: ${discountType}, Value: ${discountValue}.`);
    req.session.message = { type: 'success', text: 'Cupom criado com sucesso!' };
    res.redirect('/admin/coupons/create');

  } catch (error) {
    logger.error(`[Admin Action] Error creating coupon by Admin ID: ${adminId}. Error:`, error);
    if (error.code === 11000) { // Duplicate key error
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

    // Update fee for 'individual' account type
    await Setting.findOneAndUpdate(
      { key: 'fee_individual_percentage' },
      { value: feeValue, description: `Taxa padrão para vendedores do tipo "individual", em porcentagem.` },
      { upsert: true, new: true }
    );

    // Update fee for 'shop' account type
    await Setting.findOneAndUpdate(
      { key: 'fee_shop_percentage' },
      { value: feeValue, description: `Taxa padrão para vendedores do tipo "loja" (shop), em porcentagem.` },
      { upsert: true, new: true }
    );

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
