const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
  // ID da API de origem (ex: One Piece API)
  api_id: { 
    type: String, 
    required: false 
  },
  code: { type: String },
  rarity: { type: String },
  type: { type: String },
  name: { type: String, required: true, index: 'text' },
  images: {
    small: { type: String },
    large: { type: String }
  },
  cost: { type: Number },
  attribute: {
    name: { type: String },
    image: { type: String }
  },
  power: { type: Number },
  counter: { type: String }, // Can be "-"
  color: { type: String }, // e.g., "Red/Green"
  family: { type: String },
  ability: { type: String },
  trigger: { type: String },
  set: {
    name: { type: String }
  },
  notes: { type: Array },

  // Jogo ao qual a carta pertence
  game: {
    type: String,
    enum: ['onepiece'],
    required: true,
    index: true
  },
  
  // Campos de dados legados/internos
  set_name: { type: String }, // Mantido para possível retrocompatibilidade
  image_url: { type: String }, // Mantido para possível retrocompatibilidade
  colors: { type: Array }, // Mantido para possível retrocompatibilidade
  type_line: { type: String }, // Mantido para possível retrocompatibilidade
  legalities: { type: Object },
  price_trend: {
    type: String,
    enum: ['up', 'down', 'stable'],
    default: 'stable'
  },
  averagePrice: {
    type: Number,
    default: 0
  }
});

// Índice composto: Garante que api_id + game seja uma combinação única
// Ignora documentos que não tenham um api_id
CardSchema.index({ api_id: 1, game: 1 }, { unique: true, sparse: true });


module.exports = mongoose.model('Card', CardSchema);