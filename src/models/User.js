const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({

  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '/images/default-avatar.png' },
  fullName: { type: String },
  phone: { type: String },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  verificationTokenExpires: { type: Date },
  
  accountType: {
    type: String,
    // Adicionamos o tipo 'admin'
    enum: ['individual', 'shop', 'admin'], 
    required: true,
  },

  businessName: { type: String },
  documentType: { type: String, enum: ['CPF', 'CNPJ'], default: 'CPF' }, // Novo campo
  documentNumber: { type: String }, // Novo campo

  address: {
    cep: { type: String },
    street: { type: String },
    number: { type: String },
    complement: { type: String },
    neighborhood: { type: String }, // Novo campo
    city: { type: String },
    state: { type: String },
  },


  // --- O NOVO CAMPO MÁGICO ---
  // Se este campo tiver um valor, ele SOBRESCREVE a taxa padrão.
  // Se for nulo, o sistema usa a taxa padrão do 'accountType'.
  fee_override_percentage: { 
    type: Number,
    default: null 
  },

  lastActivityAt: { type: Date },

  createdAt: { type: Date, default: Date.now },
  firstLogin: { type: Boolean, default: true },
});

module.exports = mongoose.model('User', UserSchema);