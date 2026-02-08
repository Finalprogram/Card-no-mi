const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const FORMAT_TYPES = [
  'SWISS_TOP_CUT',
  'SINGLE_ELIM',
  'DOUBLE_ELIM',
  'GAUNTLET',
  'GROUP_BRACKETS',
  'CUSTOM_BRACKET',
  'ROUND_ROBIN',
  'LEAGUE'
];

const STATUS_TYPES = [
  'draft',
  'open',
  'in_progress',
  'finished',
  'cancelled'
];

const Tournament = sequelize.define('Tournament', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  organizerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'organizerId'
  },
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  scope: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'community',
    validate: { isIn: [['official', 'community']] }
  },
  game: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'one_piece_tcg'
  },
  formatType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'SWISS_TOP_CUT',
    validate: { isIn: [FORMAT_TYPES] }
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'draft',
    validate: { isIn: [STATUS_TYPES] }
  },
  startAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  endAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  registrationOpenAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  registrationCloseAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  locationType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'ONLINE',
    validate: { isIn: [['ONLINE', 'PRESENCIAL']] }
  },
  locationText: {
    type: DataTypes.STRING,
    allowNull: true
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 16
  },
  maxPlayers: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 16
  },
  allowWaitlist: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  entryType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'FREE',
    validate: { isIn: [['FREE', 'PAID']] }
  },
  entryFeeCents: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  currency: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'BRL'
  },
  rulesText: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  rules: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  prizesText: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  storeCreditPrizeCents: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  storeCreditStoreId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  storeCreditNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  contactText: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  timePerRoundMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 35
  },
  swissRounds: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  topCutSize: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  isRankingEligible: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  visibility: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'PUBLIC',
    validate: { isIn: [['PUBLIC', 'UNLISTED', 'PRIVATE']] }
  },
  bannerUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  policyConfig: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {
      fullRefundHoursBeforeStart: 24,
      partialRefundPercentHoursBeforeStart: 50,
      partialRefundHoursBeforeStart: 2,
      allowRefundAfterStart: false
    }
  }
}, {
  tableName: 'tournaments',
  timestamps: true
});

Tournament.addHook('beforeValidate', (instance) => {
  if (!instance.organizerId && instance.createdById) instance.organizerId = instance.createdById;
  if (!instance.createdById && instance.organizerId) instance.createdById = instance.organizerId;
  if (!instance.capacity && instance.maxPlayers) instance.capacity = instance.maxPlayers;
  if (!instance.maxPlayers && instance.capacity) instance.maxPlayers = instance.capacity;
  if (!instance.rulesText && instance.rules) instance.rulesText = instance.rules;
  if (!instance.rules && instance.rulesText) instance.rules = instance.rulesText;
});

Object.defineProperty(Tournament.prototype, '_id', {
  get() {
    return this.id;
  }
});

module.exports = Tournament;
