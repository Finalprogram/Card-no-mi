// src/models/Order.js
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  card: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card',
    required: true
  },
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    // Not strictly required, as a card might be bought from the system directly
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  // Store some denormalized data to avoid breaking if original card/listing changes
  cardName: String,
  sellerName: String,
  isReviewed: { type: Boolean, default: false },
  marketplaceFee: { type: Number, required: true },
  sellerNet: { type: Number, required: true },
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  totals: {
    subtotal: { type: Number, required: true },
    shipping: { type: Number, required: true },
    grand: { type: Number, required: true },
    marketplaceFee: { type: Number, required: true },
    sellerNet: { type: Number, required: true }
  },
  shippingAddress: {
    type: String, // For simplicity, storing the formatted address string
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Processing'
  },
  trackingCode: {
    type: String,
  },
  melhorEnvioShipmentId: {
    type: String,
  },
  melhorEnvioLabelUrl: {
    type: String,
  },
  melhorEnvioTrackingUrl: {
    type: String,
  },
  melhorEnvioService: {
    type: String,
  },
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;