const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  avatar: {
    type: DataTypes.STRING,
    defaultValue: '/images/default-avatar.png'
  },
  fullName: {
    type: DataTypes.STRING
  },
  phone: {
    type: DataTypes.STRING
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  verificationToken: {
    type: DataTypes.STRING
  },
  verificationTokenExpires: {
    type: DataTypes.DATE
  },
  bio: {
    type: DataTypes.STRING(500),
    defaultValue: ''
  },
  signature: {
    type: DataTypes.STRING(200),
    defaultValue: ''
  },
  forumTitle: {
    type: DataTypes.STRING(50),
    defaultValue: ''
  },
  website: {
    type: DataTypes.STRING
  },
  location: {
    type: DataTypes.STRING
  },
  faction: {
    type: DataTypes.ENUM('pirate', 'marine'),
    allowNull: true,
    defaultValue: null
  },
  factionRank: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  factionPoints: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  factionJoinedAt: {
    type: DataTypes.DATE
  },
  factionChangedAt: {
    type: DataTypes.DATE
  },
  accountType: {
    type: DataTypes.ENUM('individual', 'shop', 'store', 'partner_store', 'admin'),
    allowNull: false
  },
  businessName: {
    type: DataTypes.STRING
  },
  documentType: {
    type: DataTypes.ENUM('CPF', 'CNPJ'),
    defaultValue: 'CPF'
  },
  documentNumber: {
    type: DataTypes.STRING
  },
  fee_override_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 8.0
  },
  lastActivityAt: {
    type: DataTypes.DATE
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  socialLinks: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  address: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  bankInfo: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  payoutSettings: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  balance: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  firstLogin: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isCreator: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'users',
  timestamps: true
});

Object.defineProperty(User.prototype, '_id', {
  get() {
    return this.id;
  }
});

module.exports = User;
