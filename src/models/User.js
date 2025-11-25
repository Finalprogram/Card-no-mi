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
  
  // Perfil do Fórum
  bio: { type: String, maxlength: 500, default: '' },
  signature: { type: String, maxlength: 200, default: '' },
  forumTitle: { type: String, maxlength: 50, default: '' }, // Ex: "Jogador Veterano", "Colecionador"
  website: { type: String },
  location: { type: String },
  socialLinks: {
    twitter: { type: String },
    instagram: { type: String },
    youtube: { type: String },
    twitch: { type: String }
  },
  
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
    default: 8.0  // Valor padrão de 8% 
  },

  // Dados bancários para repasses
  bankInfo: {
    // Dados PIX
    pixKey: { type: String },
    pixKeyType: { 
      type: String, 
      enum: ['cpf', 'cnpj', 'email', 'phone', 'random', null],
      default: null 
    },
    
    // Dados bancários tradicionais
    bankName: { type: String },
    bankCode: { type: String },
    accountType: { 
      type: String, 
      enum: ['checking', 'savings', null],
      default: null 
    },
    accountNumber: { type: String },
    accountDigit: { type: String },
    agencyNumber: { type: String },
    agencyDigit: { type: String },
    
    // Método preferencial
    preferredPaymentMethod: {
      type: String,
      enum: ['PIX', 'BankTransfer', 'MercadoPago', null],
      default: 'PIX'
    },
    
    // Verificação
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date }
  },

  // Configurações de repasse
  payoutSettings: {
    // Frequência desejada de repasse
    frequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly', 'on-demand'],
      default: 'weekly'
    },
    
    // Valor mínimo para solicitar repasse
    minimumAmount: {
      type: Number,
      default: 50.00 // R$ 50,00
    },
    
    // Auto-repasse quando atingir o valor mínimo
    autoPayoutEnabled: {
      type: Boolean,
      default: false
    },
    
    // Dia preferencial para repasse (1-31)
    preferredPayoutDay: {
      type: Number,
      min: 1,
      max: 31,
      default: 1
    }
  },

  // Saldo disponível para saque
  balance: {
    available: { type: Number, default: 0 },      // Disponível para saque
    pending: { type: Number, default: 0 },        // Pendente (pedidos não entregues)
    frozen: { type: Number, default: 0 },         // Congelado (disputas, problemas)
    lifetime: { type: Number, default: 0 }        // Total histórico de vendas
  },

  lastActivityAt: { type: Date },

  createdAt: { type: Date, default: Date.now },
  firstLogin: { type: Boolean, default: true },
});

module.exports = mongoose.model('User', UserSchema);