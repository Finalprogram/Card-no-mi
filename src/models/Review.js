// src/models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  // O item específico do pedido que está sendo avaliado
  orderItemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    trim: true,
  },
}, { timestamps: true });

// Garante que um comprador só possa avaliar um item de um pedido uma única vez
reviewSchema.index({ order: 1, orderItemId: 1, buyer: 1 }, { unique: true });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
