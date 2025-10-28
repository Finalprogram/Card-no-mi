const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true,
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0,
  },
  expirationDate: {
    type: Date,
    required: true,
  },
  usageLimit: {
    type: Number,
    min: 0,
    default: 1,
  },
  usedCount: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  minimumOrderAmount: {
    type: Number,
    min: 0,
    default: 0,
  },
}, { timestamps: true });

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;