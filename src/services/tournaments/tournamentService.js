const Tournament = require('../../models/Tournament');
const TournamentStage = require('../../models/TournamentStage');
const Registration = require('../../models/Registration');
const StoreCredit = require('../../models/StoreCredit');
const User = require('../../models/User');
const { TournamentError } = require('./errors');
const { logAction } = require('./auditService');
const { lockDecklists } = require('./decklistService');
const { updateFromMatches } = require('./standingsService');
const { generateSwissRound, generateTopCutBracket, swissRoundCountByPlayers } = require('./pairingService');
const { getCheckInWindow } = require('./policyService');
const { promoteFromWaitlist } = require('./registrationService');

function parseMoneyToCents(input) {
  if (input == null || input === '') return 0;
  if (typeof input === 'number') {
    return Math.max(0, Math.round(input * 100));
  }
  const normalized = String(input).trim().replace(/\s+/g, '').replace(',', '.');
  const value = Number(normalized);
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.round(value * 100));
}

function parseDateOrNull(input) {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveEntryFeeCents(payload, currentValue = 0) {
  if (payload.entryFeeReais != null && payload.entryFeeReais !== '') {
    return parseMoneyToCents(payload.entryFeeReais);
  }
  if (payload.entryFeeCents != null && payload.entryFeeCents !== '') {
    return Math.max(0, Number(payload.entryFeeCents));
  }
  return currentValue;
}

function resolveStoreCreditCents(payload, currentValue = 0) {
  if (payload.storeCreditReais != null && payload.storeCreditReais !== '') {
    return parseMoneyToCents(payload.storeCreditReais);
  }
  if (payload.storeCreditPrizeCents != null && payload.storeCreditPrizeCents !== '') {
    return Math.max(0, Number(payload.storeCreditPrizeCents));
  }
  return currentValue;
}

function ensureOrganizerPermission(tournament, user) {
  if (!user) throw new TournamentError('Não autenticado.', 401);
  const isAdmin = user.accountType === 'admin';
  const ownerId = tournament.organizerId || tournament.createdById;
  if (!isAdmin && ownerId !== user.id) {
    throw new TournamentError('Sem permissão para gerenciar torneio.', 403);
  }
}

async function createTournament(payload, actor, reqMeta = {}) {
  if (!payload.startAt || Number.isNaN(new Date(payload.startAt).getTime())) {
    throw new TournamentError('Data de inicio e obrigatoria.', 400);
  }
  const storeCreditPrizeCents = resolveStoreCreditCents(payload, 0);
  const storeCreditStoreId = payload.storeCreditStoreId ? Number(payload.storeCreditStoreId) : null;
  if (storeCreditPrizeCents > 0 && !storeCreditStoreId) {
    throw new TournamentError('Selecione a loja responsavel pelo credito.', 400);
  }
  if (storeCreditStoreId) {
    const storeUser = await User.findByPk(storeCreditStoreId);
    if (!storeUser || !['store', 'partner_store'].includes(storeUser.accountType)) {
      throw new TournamentError('Loja selecionada invalida.', 400);
    }
  }

  const tournament = await Tournament.create({
    title: payload.name || payload.title,
    description: payload.description || '',
    organizerId: actor.id,
    createdById: actor.id,
    game: 'one_piece_tcg',
    formatType: payload.formatType || 'SWISS_TOP_CUT',
    status: (payload.status || 'open').toLowerCase(),
    startAt: payload.startAt,
    endAt: payload.endAt || null,
    registrationOpenAt: parseDateOrNull(payload.registrationOpenAt),
    registrationCloseAt: parseDateOrNull(payload.registrationCloseAt),
    locationType: payload.locationType || 'ONLINE',
    locationText: payload.locationText || null,
    capacity: Number(payload.capacity || payload.maxPlayers || 16),
    maxPlayers: Number(payload.capacity || payload.maxPlayers || 16),
    allowWaitlist: payload.allowWaitlist !== false,
    entryType: payload.entryType || 'FREE',
    entryFeeCents: resolveEntryFeeCents(payload, 0),
    currency: payload.currency || 'BRL',
    rulesText: payload.rulesText || payload.rules || '',
    rules: payload.rulesText || payload.rules || '',
    prizesText: payload.prizesText || payload.prizes || '',
    storeCreditPrizeCents: storeCreditPrizeCents,
    storeCreditNotes: payload.storeCreditNotes || '',
    storeCreditStoreId,
    contactText: payload.contactText || payload.contact || '',
    timePerRoundMinutes: Number(payload.timePerRoundMinutes || 35),
    swissRounds: payload.swissRounds || null,
    topCutSize: Number(payload.topCutSize || 0),
    isRankingEligible: Boolean(payload.isRankingEligible),
    visibility: payload.visibility || 'PUBLIC',
    scope: payload.scope || 'community',
    bannerUrl: payload.bannerUrl || null
  });

  await logAction({
    actorId: actor.id,
    entityType: 'TOURNAMENT',
    entityId: tournament.id,
    action: 'CREATE_TOURNAMENT',
    after: tournament.toJSON(),
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });
  return tournament;
}

async function updateTournament(tournamentId, payload, actor, reqMeta = {}) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) throw new TournamentError('Torneio não encontrado.', 404);
  ensureOrganizerPermission(tournament, actor);
  const before = tournament.toJSON();
  const nextStoreCreditPrizeCents = resolveStoreCreditCents(payload, tournament.storeCreditPrizeCents);
  const nextStoreCreditStoreId = payload.storeCreditStoreId != null && payload.storeCreditStoreId !== ''
    ? Number(payload.storeCreditStoreId)
    : tournament.storeCreditStoreId;
  if (nextStoreCreditPrizeCents > 0 && !nextStoreCreditStoreId) {
    throw new TournamentError('Selecione a loja responsavel pelo credito.', 400);
  }
  if (nextStoreCreditStoreId) {
    const storeUser = await User.findByPk(nextStoreCreditStoreId);
    if (!storeUser || !['store', 'partner_store'].includes(storeUser.accountType)) {
      throw new TournamentError('Loja selecionada invalida.', 400);
    }
  }


  Object.assign(tournament, {
    title: payload.name || payload.title || tournament.title,
    description: payload.description ?? tournament.description,
    formatType: payload.formatType || tournament.formatType,
    startAt: payload.startAt || tournament.startAt,
    endAt: payload.endAt ?? tournament.endAt,
    registrationOpenAt: payload.registrationOpenAt !== undefined ? parseDateOrNull(payload.registrationOpenAt) : tournament.registrationOpenAt,
    registrationCloseAt: payload.registrationCloseAt !== undefined ? parseDateOrNull(payload.registrationCloseAt) : tournament.registrationCloseAt,
    locationType: payload.locationType || tournament.locationType,
    locationText: payload.locationText ?? tournament.locationText,
    capacity: payload.capacity ? Number(payload.capacity) : tournament.capacity,
    maxPlayers: payload.capacity ? Number(payload.capacity) : tournament.maxPlayers,
    allowWaitlist: typeof payload.allowWaitlist === 'boolean' ? payload.allowWaitlist : tournament.allowWaitlist,
    entryType: payload.entryType || tournament.entryType,
    entryFeeCents: resolveEntryFeeCents(payload, tournament.entryFeeCents),
    rulesText: payload.rulesText ?? payload.rules ?? tournament.rulesText,
    rules: payload.rulesText ?? payload.rules ?? tournament.rules,
    prizesText: payload.prizesText ?? payload.prizes ?? tournament.prizesText,
    storeCreditPrizeCents: nextStoreCreditPrizeCents,
    storeCreditNotes: payload.storeCreditNotes ?? tournament.storeCreditNotes,
    storeCreditStoreId: nextStoreCreditStoreId,
    contactText: payload.contactText ?? payload.contact ?? tournament.contactText,
    timePerRoundMinutes: payload.timePerRoundMinutes ? Number(payload.timePerRoundMinutes) : tournament.timePerRoundMinutes,
    swissRounds: payload.swissRounds != null ? Number(payload.swissRounds) : tournament.swissRounds,
    topCutSize: payload.topCutSize != null ? Number(payload.topCutSize) : tournament.topCutSize,
    visibility: payload.visibility || tournament.visibility,
    isRankingEligible: payload.isRankingEligible != null ? Boolean(payload.isRankingEligible) : tournament.isRankingEligible,
    bannerUrl: payload.bannerUrl ?? tournament.bannerUrl
  });
  await tournament.save();

  await logAction({
    actorId: actor.id,
    entityType: 'TOURNAMENT',
    entityId: tournament.id,
    action: 'UPDATE_TOURNAMENT',
    before,
    after: tournament.toJSON(),
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });
  return tournament;
}

async function publishTournament(tournamentId, actor, reqMeta = {}) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) throw new TournamentError('Torneio não encontrado.', 404);
  ensureOrganizerPermission(tournament, actor);
  const before = tournament.toJSON();
  tournament.status = 'open';
  if (!tournament.swissRounds && tournament.formatType === 'SWISS_TOP_CUT') {
    tournament.swissRounds = swissRoundCountByPlayers(tournament.capacity);
  }
  await tournament.save();
  await logAction({
    actorId: actor.id,
    entityType: 'TOURNAMENT',
    entityId: tournament.id,
    action: 'PUBLISH_TOURNAMENT',
    before,
    after: tournament.toJSON(),
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });
  return tournament;
}

async function openRegistration(tournamentId, actor, reqMeta = {}) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) throw new TournamentError('Torneio não encontrado.', 404);
  ensureOrganizerPermission(tournament, actor);
  const before = tournament.toJSON();
  tournament.status = 'open';
  await tournament.save();
  await logAction({
    actorId: actor.id,
    entityType: 'TOURNAMENT',
    entityId: tournament.id,
    action: 'OPEN_REGISTRATION',
    before,
    after: tournament.toJSON(),
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });
  return tournament;
}

async function closeRegistration(tournamentId, actor, reqMeta = {}) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) throw new TournamentError('Torneio não encontrado.', 404);
  ensureOrganizerPermission(tournament, actor);
  const before = tournament.toJSON();
  tournament.status = 'open';
  await tournament.save();
  await logAction({
    actorId: actor.id,
    entityType: 'TOURNAMENT',
    entityId: tournament.id,
    action: 'CLOSE_REGISTRATION',
    before,
    after: tournament.toJSON(),
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });
  return tournament;
}

async function openCheckIn(tournamentId, actor, reqMeta = {}) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) throw new TournamentError('Torneio não encontrado.', 404);
  ensureOrganizerPermission(tournament, actor);
  const { openAt } = getCheckInWindow(tournament);
  if (Date.now() < openAt.getTime()) {
    throw new TournamentError('Janela de check-in ainda não abriu.');
  }
  const before = tournament.toJSON();
  tournament.status = 'in_progress';
  await tournament.save();
  await logAction({
    actorId: actor.id,
    entityType: 'TOURNAMENT',
    entityId: tournament.id,
    action: 'OPEN_CHECKIN',
    before,
    after: tournament.toJSON(),
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });
  return tournament;
}

async function closeCheckIn(tournamentId, actor, reqMeta = {}) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) throw new TournamentError('Torneio não encontrado.', 404);
  ensureOrganizerPermission(tournament, actor);
  const before = tournament.toJSON();
  tournament.status = 'in_progress';
  await tournament.save();

  const [noShowCount] = await Registration.update(
    { status: 'NO_SHOW' },
    { where: { tournamentId, status: 'CONFIRMED' } }
  );
  for (let i = 0; i < noShowCount; i += 1) {
    await promoteFromWaitlist(tournamentId, actor.id, reqMeta);
  }
  await lockDecklists(tournamentId, actor.id, reqMeta);
  await logAction({
    actorId: actor.id,
    entityType: 'TOURNAMENT',
    entityId: tournament.id,
    action: 'CLOSE_CHECKIN',
    before,
    after: tournament.toJSON(),
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });
  return tournament;
}

async function autoSyncCheckInWindow(tournamentId, reqMeta = {}) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament || !tournament.startAt) return tournament;
  const { openAt, closeAt } = getCheckInWindow(tournament);
  const now = Date.now();

  if (now >= openAt.getTime() && now < closeAt.getTime() && tournament.status === 'open') {
    const before = tournament.toJSON();
    tournament.status = 'in_progress';
    await tournament.save();
    await logAction({
      actorId: tournament.organizerId || tournament.createdById || null,
      entityType: 'TOURNAMENT',
      entityId: tournament.id,
      action: 'AUTO_OPEN_CHECKIN',
      before,
      after: tournament.toJSON(),
      ip: reqMeta.ip,
      userAgent: reqMeta.userAgent
    });
  }

  if (now >= closeAt.getTime() && tournament.status === 'in_progress') {
    const before = tournament.toJSON();
    const [noShowCount] = await Registration.update(
      { status: 'NO_SHOW' },
      { where: { tournamentId, status: 'CONFIRMED' } }
    );
    for (let i = 0; i < noShowCount; i += 1) {
      await promoteFromWaitlist(tournamentId, tournament.organizerId || tournament.createdById || null, reqMeta);
    }
    await lockDecklists(tournamentId, tournament.organizerId || tournament.createdById || null, reqMeta);
    await logAction({
      actorId: tournament.organizerId || tournament.createdById || null,
      entityType: 'TOURNAMENT',
      entityId: tournament.id,
      action: 'AUTO_CLOSE_CHECKIN',
      before,
      after: tournament.toJSON(),
      ip: reqMeta.ip,
      userAgent: reqMeta.userAgent
    });
  }

  return tournament;
}

async function autoSyncTournamentWindows(reqMeta = {}) {
  const tournaments = await Tournament.findAll({
    where: {
      status: ['open', 'in_progress']
    }
  });
  for (const t of tournaments) {
    if (!t.startAt) continue;
    const now = Date.now();
    if (t.registrationCloseAt && now > new Date(t.registrationCloseAt).getTime() && t.status === 'open') {
      const before = t.toJSON();
      t.status = 'in_progress';
      await t.save();
      await logAction({
        actorId: t.organizerId || t.createdById || null,
        entityType: 'TOURNAMENT',
        entityId: t.id,
        action: 'AUTO_CLOSE_REGISTRATION',
        before,
        after: t.toJSON(),
        ip: reqMeta.ip,
        userAgent: reqMeta.userAgent
      });
    }
    await autoSyncCheckInWindow(t.id, reqMeta);
  }
  return tournaments.length;
}


async function startTournament(tournamentId, actor, reqMeta = {}) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) throw new TournamentError('Torneio não encontrado.', 404);
  ensureOrganizerPermission(tournament, actor);
  const before = tournament.toJSON();

  const checkedIn = await Registration.count({ where: { tournamentId, status: ['CHECKED_IN', 'DROPPED'] } });
  if (checkedIn < 2) throw new TournamentError('Mínimo de 2 jogadores com check-in.');

  tournament.status = 'in_progress';
  await tournament.save();
  await lockDecklists(tournamentId, actor.id, reqMeta);

  if (tournament.formatType === 'SWISS_TOP_CUT') {
    await generateSwissRound(tournament);
  }

  await logAction({
    actorId: actor.id,
    entityType: 'TOURNAMENT',
    entityId: tournament.id,
    action: 'START_TOURNAMENT',
    before,
    after: tournament.toJSON(),
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });
  return tournament;
}

async function finishTournament(tournamentId, actor, reqMeta = {}) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) throw new TournamentError('Torneio não encontrado.', 404);
  ensureOrganizerPermission(tournament, actor);
  const before = tournament.toJSON();
  tournament.status = 'finished';
  await tournament.save();
  await updateFromMatches(tournamentId);
  if (tournament.storeCreditPrizeCents > 0 && tournament.storeCreditStoreId) {
    const TournamentStanding = require('../../models/TournamentStanding');
    const topStanding = await TournamentStanding.findOne({
      where: { tournamentId },
      order: [['rank', 'ASC']]
    });
    if (topStanding) {
      const existing = await StoreCredit.findOne({
        where: {
          tournamentId,
          storeId: tournament.storeCreditStoreId,
          playerId: topStanding.playerId
        }
      });
      if (!existing) {
        await StoreCredit.create({
          tournamentId,
          storeId: tournament.storeCreditStoreId,
          playerId: topStanding.playerId,
          amountCents: tournament.storeCreditPrizeCents,
          notes: tournament.storeCreditNotes || 'CrÃ©dito de torneio'
        });
      }
    }
  }
  await logAction({
    actorId: actor.id,
    entityType: 'TOURNAMENT',
    entityId: tournament.id,
    action: 'FINISH_TOURNAMENT',
    before,
    after: tournament.toJSON(),
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });
  return tournament;
}

async function cancelTournament(tournamentId, actor, reqMeta = {}) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) throw new TournamentError('Torneio não encontrado.', 404);
  ensureOrganizerPermission(tournament, actor);
  const before = tournament.toJSON();
  tournament.status = 'cancelled';
  await tournament.save();
  await logAction({
    actorId: actor.id,
    entityType: 'TOURNAMENT',
    entityId: tournament.id,
    action: 'CANCEL_TOURNAMENT',
    before,
    after: tournament.toJSON(),
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });
  return tournament;
}

async function createTopCut(tournamentId, actor, size, reqMeta = {}) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) throw new TournamentError('Torneio não encontrado.', 404);
  ensureOrganizerPermission(tournament, actor);
  const result = await generateTopCutBracket(tournament, size || tournament.topCutSize || 8);
  await logAction({
    actorId: actor.id,
    entityType: 'STAGE',
    entityId: result.stageId,
    action: 'GENERATE_TOPCUT',
    after: result,
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });
  return result;
}

module.exports = {
  createTournament,
  updateTournament,
  publishTournament,
  openRegistration,
  closeRegistration,
  openCheckIn,
  closeCheckIn,
  autoSyncCheckInWindow,
  autoSyncTournamentWindows,
  startTournament,
  finishTournament,
  cancelTournament,
  createTopCut
};
