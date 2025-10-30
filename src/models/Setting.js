const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  // A "chave" da configuração, ex: "fee_individual"
  key: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  // O "valor" da configuração. 'Mixed' permite guardar qualquer tipo de dado (número, texto, etc.)
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  description: {
    type: String,
  }
});

module.exports = mongoose.model('Setting', SettingSchema);