const User = require('../models/User');
const Order = require('../models/Order');
const Setting = require('../models/Setting');

async function showDashboard(req, res) {
  try {
    // Placeholder for dashboard data
    const totalUsers = await User.countDocuments();
    const totalOrders = await Order.countDocuments();

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
      totalMarketplaceRevenue: totalMarketplaceRevenue.toFixed(2),
      pageTitle: 'Admin Dashboard'
    });
  } catch (error) {
    console.error('Error showing admin dashboard:', error);
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
      defaultFees[type] = setting ? setting.value : 0;
    }

    res.render('admin/users', {
      layout: 'layouts/admin',
      users,
      defaultFees,
      pageTitle: 'Manage Users'
    });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).send('Internal Server Error');
  }
}

async function setFee(req, res) {
  try {
    const { id } = req.params;
    const { fee_override_percentage } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.fee_override_percentage = fee_override_percentage === 'null' ? null : Number(fee_override_percentage);
    await user.save();

    res.json({ success: true, message: 'Fee updated successfully.' });
  } catch (error) {
    console.error('Error setting user fee:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = {
  showDashboard,
  listUsers,
  setFee,
};
