const logger = require('../../config/logger');
const Tournament = require('../../models/Tournament');
const Registration = require('../../models/Registration');
const TournamentPayment = require('../../models/TournamentPayment');
const DecklistSnapshot = require('../../models/DecklistSnapshot');
const TournamentStage = require('../../models/TournamentStage');
const TournamentMatch = require('../../models/TournamentMatch');
const TournamentStanding = require('../../models/TournamentStanding');
const AuditLog = require('../../models/AuditLog');
const StoreCredit = require('../../models/StoreCredit');

let bootstrapped = false;

async function ensureTournamentSchema() {
  if (bootstrapped) return;
  try {
    await Tournament.sync({ alter: true });
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('already exists') || message.includes('já existe')) {
      logger.warn('[tournaments] Tournament sync warning (column already exists). Continuing.', { message });
      await Tournament.sync();
    } else {
      throw error;
    }
  }
  await Registration.sync({ alter: true });
  await TournamentPayment.sync({ alter: true });
  await DecklistSnapshot.sync({ alter: true });
  await TournamentStage.sync({ alter: true });
  await TournamentMatch.sync({ alter: true });
  await TournamentStanding.sync({ alter: true });
  await AuditLog.sync({ alter: true });
  await StoreCredit.sync({ alter: true });
  bootstrapped = true;
  logger.info('[tournaments] Schema checked/synced');
}

module.exports = { ensureTournamentSchema };
