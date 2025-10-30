// src/models/Listing.js
const mongoose = require('mongoose');

const ListingSchema = new mongoose.Schema({
  // 'ref' diz ao Mongoose que este ID se refere a um documento na coleção 'Card'
  card: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, default: 1 },
  condition: { type: String, enum: ['NM', 'LP', 'MP', 'HP'], default: 'NM' }, // Near Mint, Lightly Played...
  is_foil: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
   extras: [{ type: String }], 
   language:{ type: String, default:'EN', required:true },
});

module.exports = mongoose.model('Listing', ListingSchema);