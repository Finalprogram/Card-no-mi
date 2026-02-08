const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const PartnerStore = sequelize.define('PartnerStore', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  storeName: {
    type: DataTypes.STRING(120),
    allowNull: false
  },
  logoUrl: {
    type: DataTypes.STRING
  },
  websiteUrl: {
    type: DataTypes.STRING
  },
  instagramUrl: {
    type: DataTypes.STRING
  },
  whatsappUrl: {
    type: DataTypes.STRING
  },
  contactEmail: {
    type: DataTypes.STRING
  },
  legalName: {
    type: DataTypes.STRING(160)
  },
  primaryLink: {
    type: DataTypes.STRING
  },
  operatingTime: {
    type: DataTypes.STRING(80)
  },
  salesPlatforms: {
    type: DataTypes.TEXT
  },
  physicalAddress: {
    type: DataTypes.STRING(200)
  },
  focusOnePiece: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  eventsHosted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  eventsDetails: {
    type: DataTypes.STRING(400)
  },
  bannerUrl: {
    type: DataTypes.STRING
  },
  city: {
    type: DataTypes.STRING(80)
  },
  state: {
    type: DataTypes.STRING(40)
  },
  description: {
    type: DataTypes.STRING(400)
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
    defaultValue: 'PENDING'
  },
  approvedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'partner_stores',
  timestamps: true
});

module.exports = PartnerStore;
