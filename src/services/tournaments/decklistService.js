const crypto = require('crypto');
const DecklistSnapshot = require('../../models/DecklistSnapshot');
const Registration = require('../../models/Registration');
const Tournament = require('../../models/Tournament');
const { TournamentError } = require('./errors');
const { logAction } = require('./auditService');

function normalizeList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => ({ cardId: String(item.cardId || item.code || '').trim(), qty: Number(item.qty || item.quantity || 0) }))
    .filter((item) => item.cardId && Number.isInteger(item.qty) && item.qty > 0);
}

function sumDeckQty(list) {
  return list.reduce((sum, item) => sum + item.qty, 0);
}

function makeHash(payload) {
  const content = JSON.stringify(payload);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function validateDecklist({ leaderCode, mainDeck, donDeck }) {
  if (!leaderCode || typeof leaderCode !== 'string') {
    throw new TournamentError('Leader obrigatório para One Piece TCG.');
  }
  const main = normalizeList(mainDeck);
  const don = normalizeList(donDeck);
  if (sumDeckQty(main) !== 50) {
    throw new TournamentError('Main Deck deve ter exatamente 50 cartas.');
  }
  if (sumDeckQty(don) !== 10) {
    throw new TournamentError('DON Deck deve ter exatamente 10 cartas.');
  }
  return { main, don };
}

async function submitDecklist({ tournamentId, registrationId, playerId, leaderCode, mainDeck, donDeck, actorId, reqMeta }) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) throw new TournamentError('Torneio não encontrado.', 404);

  const registration = await Registration.findByPk(registrationId);
  if (!registration || registration.tournamentId !== tournamentId || registration.userId !== playerId) {
    throw new TournamentError('Inscrição inválida para envio de decklist.', 403);
  }

  const existing = await DecklistSnapshot.findOne({ where: { tournamentId, playerId } });
  if (existing?.lockedAt) {
    throw new TournamentError('Decklist já travada. Não é possível editar.');
  }

  const { main, don } = validateDecklist({ leaderCode, mainDeck, donDeck });
  const payload = { leaderCode: leaderCode.trim(), mainDeck: main, donDeck: don };
  const hash = makeHash(payload);

  const before = existing ? existing.toJSON() : null;
  let snapshot;
  if (existing) {
    existing.leaderCode = payload.leaderCode;
    existing.mainDeck = payload.mainDeck;
    existing.donDeck = payload.donDeck;
    existing.hash = hash;
    snapshot = await existing.save();
  } else {
    snapshot = await DecklistSnapshot.create({
      tournamentId,
      playerId,
      registrationId,
      ...payload,
      hash
    });
  }

  await logAction({
    actorId,
    entityType: 'DECKLIST',
    entityId: snapshot.id,
    action: before ? 'UPDATE_DECKLIST' : 'CREATE_DECKLIST',
    before,
    after: snapshot.toJSON(),
    ip: reqMeta?.ip,
    userAgent: reqMeta?.userAgent
  });
  return snapshot;
}

async function lockDecklists(tournamentId, actorId, reqMeta) {
  const snapshots = await DecklistSnapshot.findAll({ where: { tournamentId, lockedAt: null } });
  const now = new Date();
  await Promise.all(snapshots.map(async (snapshot) => {
    const before = snapshot.toJSON();
    snapshot.lockedAt = now;
    await snapshot.save();
    await logAction({
      actorId,
      entityType: 'DECKLIST',
      entityId: snapshot.id,
      action: 'LOCK_DECKLIST',
      before,
      after: snapshot.toJSON(),
      ip: reqMeta?.ip,
      userAgent: reqMeta?.userAgent
    });
  }));
  return snapshots.length;
}

async function getMyDecklist(tournamentId, playerId) {
  return DecklistSnapshot.findOne({ where: { tournamentId, playerId } });
}

module.exports = {
  submitDecklist,
  lockDecklists,
  getMyDecklist,
  validateDecklist
};

