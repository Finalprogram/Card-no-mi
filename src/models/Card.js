const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
  // // ID do Scryfall (único para Magic)
  // scryfall_id: { 
  //   type: String, 
  //   unique: true, 
  //   required: false, // Não é obrigatório
  //   sparse: true     // ESSENCIAL: Garante que a regra 'unique' ignore os valores nulos
  // },
  
  // ID da API de origem (ex: One Piece API)
  api_id: { 
    type: String, 
    required: false 
  },

  // Jogo ao qual a carta pertence
  game: {
    type: String,
    enum: ['onepiece'],
    required: true,
    index: true
  },
  
  // Campos de dados principais
  name: { type: String, required: true, index: true },
  set_name: { type: String },
  image_url: { type: String }, 
  rarity: { type: String },
  colors: { type: Array },
  type_line: { type: String },
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