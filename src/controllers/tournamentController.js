const logger = require('../config/logger');
const Tournament = require('../models/Tournament');
const Registration = require('../models/Registration');
const TournamentPayment = require('../models/TournamentPayment');
const DecklistSnapshot = require('../models/DecklistSnapshot');
const TournamentMatch = require('../models/TournamentMatch');
const TournamentStage = require('../models/TournamentStage');
const TournamentStanding = require('../models/TournamentStanding');
const User = require('../models/User');
const {
  createTournament,
  updateTournament,
  publishTournament,
  openRegistration,
  closeRegistration,
  openCheckIn,
  closeCheckIn,
  autoSyncCheckInWindow,
  startTournament,
  finishTournament,
  cancelTournament,
  createTopCut
} = require('../services/tournaments/tournamentService');
const {
  registerPlayer,
  cancelRegistration,
  checkInPlayer,
  dropPlayer
} = require('../services/tournaments/registrationService');
const { submitDecklist, getMyDecklist } = require('../services/tournaments/decklistService');
const { createCharge, handleWebhook, refundCharge } = require('../services/tournaments/paymentService');
const { updateFromMatches, getStandings } = require('../services/tournaments/standingsService');
const { generateSwissRound, generateMatchesForFormat } = require('../services/tournaments/pairingService');
const { isPlayerInMatch, canConfirmReportedResult } = require('../services/tournaments/matchResultService');
const { ensureTournamentSchema } = require('../services/tournaments/bootstrapService');
const { TournamentError } = require('../services/tournaments/errors');

function requestMeta(req) {
  return {
    ip: req.ip,
    userAgent: req.get('user-agent')
  };
}

function actor(req) {
  return req.session?.user || null;
}

function mapLegacyFormat(format) {
  if (!format) return undefined;
  if (format === 'swiss') return 'SWISS_TOP_CUT';
  if (format === 'single_elimination') return 'SINGLE_ELIM';
  if (format === 'double_elimination') return 'DOUBLE_ELIM';
  return format;
}

function wantsJson(req) {
  const accept = (req.headers.accept || '').toLowerCase();
  return accept.includes('application/json') || req.query.format === 'json';
}

function isTournamentManager(tournament, user) {
  if (!user) return false;
  if (user.accountType === 'admin') return true;
  const ownerId = tournament.organizerId || tournament.createdById;
  return ownerId === user.id;
}

function normalizeTournamentForView(tournament) {
  const t = tournament.toJSON ? tournament.toJSON() : tournament;
  const scope = t.scope || 'community';
  const statusMap = {
    DRAFT: 'draft',
    PUBLISHED: 'open',
    REG_OPEN: 'open',
    REG_CLOSED: 'open',
    CHECKIN_OPEN: 'in_progress',
    CHECKIN_CLOSED: 'in_progress',
    RUNNING: 'in_progress',
    FINISHED: 'finished',
    CANCELLED: 'cancelled',
    draft: 'draft',
    open: 'open',
    in_progress: 'in_progress',
    finished: 'finished',
    cancelled: 'cancelled'
  };
  return {
    ...t,
    scope,
    status: statusMap[t.status] || t.status,
    format: t.formatType === 'SINGLE_ELIM' ? 'single_elimination' : 'swiss',
    maxPlayers: t.capacity || t.maxPlayers || 16
  };
}

function handleError(res, error) {
  if (error instanceof TournamentError) {
    return res.status(error.status).json({ message: error.message, code: error.code });
  }
  logger.error('[tournaments] unexpected error', error);
  return res.status(500).json({ message: 'Erro interno do servidor.' });
}

exports.listPage = async (req, res) => {
  await ensureTournamentSchema();
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.formatType) where.formatType = req.query.formatType;
  if (req.query.visibility) where.visibility = req.query.visibility;

  const tournaments = await Tournament.findAll({
    where,
    include: [{ model: User, as: 'organizer', attributes: ['id', 'username'] }],
    order: [['createdAt', 'DESC']]
  });

  if (wantsJson(req)) {
    return res.json({ tournaments });
  }

  const normalized = tournaments.map(normalizeTournamentForView);
  const official = normalized.filter((t) => t.scope === 'official');
  const community = normalized.filter((t) => t.scope === 'community');
  return res.render('pages/tournaments/index', {
    title: 'Torneios',
    official,
    community
  });
};

exports.createPage = async (req, res) => {
  await ensureTournamentSchema();
  const storeCreditStores = await User.findAll({
    where: { accountType: ['store', 'partner_store'] },
    attributes: ['id', 'username', 'businessName'],
    order: [['businessName', 'ASC'], ['username', 'ASC']]
  });
  return res.render('pages/tournaments/create', {
    title: 'Criar Torneio',
    storeCreditStores
  });
};

exports.create = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const currentActor = actor(req);
    if (!currentActor) throw new TournamentError('Não autenticado.', 401);
    const startAt = req.body.startAt ? new Date(req.body.startAt) : null;
    if (!startAt || Number.isNaN(startAt.getTime())) {
      throw new TournamentError('Data de início é obrigatória.', 400);
    }

    const payload = {
      ...req.body,
      name: req.body.name || req.body.title,
      startAt,
      formatType: mapLegacyFormat(req.body.formatType || req.body.format),
      bannerUrl: req.file ? `/uploads/tournaments/${req.file.filename}` : (req.body.bannerUrl || null)
    };
    const tournament = await createTournament(payload, currentActor, requestMeta(req));
    req.flash('success_msg', 'Torneio criado com sucesso.');
    if (wantsJson(req)) return res.status(201).json(tournament);
    return res.redirect(`/tournaments/${tournament.id}`);
  } catch (error) {
    if (!wantsJson(req)) {
      req.flash('error_msg', error.message || 'Erro ao criar torneio.');
      return res.redirect('/tournaments/create');
    }
    return handleError(res, error);
  }
};

exports.update = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const payload = {
      ...req.body,
      formatType: mapLegacyFormat(req.body.formatType || req.body.format)
    };
    const tournament = await updateTournament(Number(req.params.id), payload, actor(req), requestMeta(req));
    return res.json(tournament);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.publish = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const tournament = await publishTournament(Number(req.params.id), actor(req), requestMeta(req));
    return res.json(tournament);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.openRegistration = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const tournament = await openRegistration(Number(req.params.id), actor(req), requestMeta(req));
    return res.json(tournament);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.closeRegistration = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const tournament = await closeRegistration(Number(req.params.id), actor(req), requestMeta(req));
    return res.json(tournament);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.openCheckIn = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const tournament = await openCheckIn(Number(req.params.id), actor(req), requestMeta(req));
    return res.json(tournament);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.closeCheckIn = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const tournament = await closeCheckIn(Number(req.params.id), actor(req), requestMeta(req));
    return res.json(tournament);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.start = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const tournament = await startTournament(Number(req.params.id), actor(req), requestMeta(req));
    return res.json(tournament);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.finish = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const tournament = await finishTournament(Number(req.params.id), actor(req), requestMeta(req));
    return res.json(tournament);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.cancel = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const tournament = await cancelTournament(Number(req.params.id), actor(req), requestMeta(req));
    return res.json(tournament);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.detailPage = async (req, res) => {
  await ensureTournamentSchema();
  const tournamentId = Number(req.params.id);
  await autoSyncCheckInWindow(tournamentId, requestMeta(req));
  const tournament = await Tournament.findByPk(tournamentId, {
    include: [
      { model: User, as: 'organizer', attributes: ['id', 'username'] },
      { model: User, as: 'storeCreditStore', attributes: ['id', 'username', 'businessName'] }
    ]
  });
  if (!tournament) {
    if (wantsJson(req)) return res.status(404).json({ message: 'Torneio não encontrado.' });
    req.flash('error_msg', 'Torneio não encontrado.');
    return res.redirect('/tournaments');
  }

  if (wantsJson(req)) return res.json(tournament);

  const participants = await Registration.findAll({
    where: { tournamentId },
    include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }],
    order: [['points', 'DESC'], ['wins', 'DESC'], ['displayName', 'ASC']]
  });
  const participantsList = participants;
  const matches = await TournamentMatch.findAll({
    where: { tournamentId },
    include: [
      { model: Registration, as: 'playerA' },
      { model: Registration, as: 'playerB' },
      { model: Registration, as: 'winner' }
    ],
    order: [['roundNumber', 'DESC'], ['tableNumber', 'ASC']]
  });
  const groupedMatches = matches.reduce((acc, m) => {
    acc[m.roundNumber] = acc[m.roundNumber] || [];
    acc[m.roundNumber].push(m);
    return acc;
  }, {});
  const latestMatch = matches.length ? matches[0] : null;
  const stageId = latestMatch?.stageId || null;
  let standings = await TournamentStanding.findAll({
    where: { tournamentId, ...(stageId ? { stageId } : {}) },
    order: [['rank', 'ASC']]
  });
  if (!standings.length && matches.length) {
    const confirmedMatches = matches.filter((m) => m.resultStatus === 'CONFIRMED');
    if (confirmedMatches.length) {
      await updateFromMatches(tournamentId, stageId || null);
      standings = await TournamentStanding.findAll({
        where: { tournamentId, ...(stageId ? { stageId } : {}) },
        order: [['rank', 'ASC']]
      });
      if (!standings.length && stageId) {
        await updateFromMatches(tournamentId, null);
        standings = await TournamentStanding.findAll({
          where: { tournamentId },
          order: [['rank', 'ASC']]
        });
      }
    }
  }
  const standingsUpdatedAt = standings.length
    ? standings.reduce((latest, row) => (latest && latest > row.updatedAt ? latest : row.updatedAt), standings[0].updatedAt)
    : null;
  const participantsById = new Map(participants.map((p) => [p.id, p]));
  let participantsWithStandings = standings.length
    ? standings.map((s) => {
      const base = participantsById.get(s.registrationId);
      const basePlain = base && typeof base.toJSON === 'function' ? base.toJSON() : base;
      const fallback = {
        id: s.registrationId,
        userId: s.playerId,
        displayName: s.playerId ? `Jogador ${s.playerId}` : 'Jogador'
      };
      return {
        ...(basePlain || fallback),
        points: s.points,
        wins: s.wins,
        losses: s.losses,
        draws: s.draws,
        omw: s.omw,
        gw: s.gw,
        ogw: s.ogw
      };
    }).filter((p) => p && p.id)
    : participants;

  if (!participantsWithStandings.length) {
    participantsWithStandings = participants;
  }

  participantsWithStandings = participantsWithStandings.map((p) => ({
    ...p,
    points: Number.isFinite(p.points) ? p.points : 0,
    wins: Number.isFinite(p.wins) ? p.wins : 0,
    losses: Number.isFinite(p.losses) ? p.losses : 0,
    draws: Number.isFinite(p.draws) ? p.draws : 0,
    omw: Number.isFinite(p.omw) ? p.omw : 0,
    gw: Number.isFinite(p.gw) ? p.gw : 0,
    ogw: Number.isFinite(p.ogw) ? p.ogw : 0
  }));
  const userId = req.session?.user?.id;
  const myEntry = userId ? participantsWithStandings.find((p) => p.userId === userId) : null;
  const canManage = userId && isTournamentManager(tournament, req.session?.user);

  return res.render('pages/tournaments/detail', {
    title: tournament.title,
    tournament: normalizeTournamentForView(tournament),
    participants: participantsWithStandings,
    participantsList,
    groupedMatches,
    myEntry,
    canManage,
    standingsUpdatedAt
  });
};

exports.register = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const currentActor = actor(req);
    if (!currentActor) throw new TournamentError('Não autenticado.', 401);
    const result = await registerPlayer({
      tournamentId: Number(req.params.id),
      playerId: currentActor.id,
      actorId: currentActor.id,
      reqMeta: requestMeta(req)
    });
    return res.status(201).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.cancelMyRegistration = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const currentActor = actor(req);
    if (!currentActor) throw new TournamentError('Não autenticado.', 401);
    const result = await cancelRegistration({
      tournamentId: Number(req.params.id),
      playerId: currentActor.id,
      actorId: currentActor.id,
      reqMeta: requestMeta(req)
    });
    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.checkIn = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const currentActor = actor(req);
    if (!currentActor) throw new TournamentError('Não autenticado.', 401);
    const result = await checkInPlayer({
      tournamentId: Number(req.params.id),
      playerId: currentActor.id,
      actorId: currentActor.id,
      reqMeta: requestMeta(req)
    });
    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.dropRegistration = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const currentActor = actor(req);
    if (!currentActor) throw new TournamentError('Não autenticado.', 401);
    const result = await dropPlayer({
      tournamentId: Number(req.params.id),
      playerId: currentActor.id,
      actorId: currentActor.id,
      reqMeta: requestMeta(req)
    });
    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.listRegistrations = async (req, res) => {
  await ensureTournamentSchema();
  const tournament = await Tournament.findByPk(Number(req.params.id));
  if (!tournament) return res.status(404).json({ message: 'Torneio não encontrado.' });
  const user = actor(req);
  if (!isTournamentManager(tournament, user)) {
    return res.status(403).json({ message: 'Sem permissão.' });
  }
  const rows = await Registration.findAll({ where: { tournamentId: tournament.id }, order: [['createdAt', 'ASC']] });
  return res.json(rows);
};

exports.getParticipantProfile = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const tournamentId = Number(req.params.id);
    const participantId = Number(req.params.participantId);
    const tournament = await Tournament.findByPk(tournamentId);
    if (!tournament) return res.status(404).json({ message: 'Torneio n??o encontrado.' });

    const currentActor = actor(req);
    const canManage = isTournamentManager(tournament, currentActor);
    if (tournament.visibility === 'PRIVATE' && !canManage) {
      return res.status(403).json({ message: 'Sem permiss??o.' });
    }

    const participant = await Registration.findOne({
      where: { id: participantId, tournamentId },
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }]
    });
    if (!participant) return res.status(404).json({ message: 'Participante n??o encontrado.' });

    const decklist = await DecklistSnapshot.findOne({
      where: { tournamentId, playerId: participant.userId }
    });

    const recentEntries = await Registration.findAll({
      where: { userId: participant.userId },
      include: [{ model: Tournament, as: 'tournament', attributes: ['id', 'title', 'startAt', 'status', 'formatType'] }],
      order: [['createdAt', 'DESC']],
      limit: 3
    });

    return res.json({
      participant: {
        id: participant.id,
        userId: participant.userId,
        displayName: participant.displayName,
        avatar: participant.user?.avatar || null,
        username: participant.user?.username || null
      },
      decklist: decklist
        ? { leaderCode: decklist.leaderCode, lockedAt: decklist.lockedAt }
        : null,
      recentTournaments: recentEntries
        .filter((entry) => entry.tournament)
        .map((entry) => ({
          id: entry.tournament.id,
          title: entry.tournament.title,
          startAt: entry.tournament.startAt,
          status: entry.tournament.status,
          formatType: entry.tournament.formatType
        }))
    });
  } catch (error) {
    return handleError(res, error);
  }
};


exports.myRegistrations = async (req, res) => {
  await ensureTournamentSchema();
  const currentActor = actor(req);
  if (!currentActor) return res.status(401).json({ message: 'Não autenticado.' });
  const rows = await Registration.findAll({
    where: { userId: currentActor.id },
    include: [{ model: Tournament, as: 'tournament' }],
    order: [['createdAt', 'DESC']]
  });
  return res.json(rows);
};

exports.createPaymentCharge = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const currentActor = actor(req);
    if (!currentActor) throw new TournamentError('Não autenticado.', 401);
    const registration = await Registration.findOne({
      where: { tournamentId: Number(req.params.id), userId: currentActor.id, status: ['PENDING', 'WAITING_LIST'] }
    });
    if (!registration) throw new TournamentError('Inscrição elegível para pagamento não encontrada.', 404);
    const payment = await createCharge({
      tournamentId: Number(req.params.id),
      registrationId: registration.id,
      playerId: currentActor.id,
      provider: req.body.provider || 'PIX',
      actorId: currentActor.id,
      reqMeta: requestMeta(req)
    });
    return res.status(201).json(payment);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.webhook = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const result = await handleWebhook(req.body, requestMeta(req));
    return res.json({ ok: true, ...result });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.refund = async (req, res) => {
  await ensureTournamentSchema();
  const user = actor(req);
  if (!user || user.accountType !== 'admin') return res.status(403).json({ message: 'Sem permissão.' });
  try {
    const payment = await refundCharge({
      paymentId: Number(req.body.paymentId),
      amountPercent: Number(req.body.amountPercent || 100),
      actorId: user.id,
      reqMeta: requestMeta(req)
    });
    return res.json(payment);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.submitDecklist = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const currentActor = actor(req);
    if (!currentActor) throw new TournamentError('Não autenticado.', 401);
    const registration = await Registration.findOne({
      where: { tournamentId: Number(req.params.id), userId: currentActor.id, status: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] }
    });
    if (!registration) throw new TournamentError('Inscrição não encontrada.', 404);
    const snapshot = await submitDecklist({
      tournamentId: Number(req.params.id),
      registrationId: registration.id,
      playerId: currentActor.id,
      leaderCode: req.body.leaderCode,
      mainDeck: req.body.mainDeck,
      donDeck: req.body.donDeck,
      actorId: currentActor.id,
      reqMeta: requestMeta(req)
    });
    return res.status(201).json(snapshot);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getDecklists = async (req, res) => {
  await ensureTournamentSchema();
  const tournament = await Tournament.findByPk(Number(req.params.id));
  if (!tournament) return res.status(404).json({ message: 'Torneio não encontrado.' });
  const user = actor(req);
  if (!isTournamentManager(tournament, user)) {
    return res.status(403).json({ message: 'Sem permissão.' });
  }
  const rows = await DecklistSnapshot.findAll({ where: { tournamentId: tournament.id } });
  return res.json(rows);
};

exports.getMyDecklist = async (req, res) => {
  await ensureTournamentSchema();
  const currentActor = actor(req);
  if (!currentActor) return res.status(401).json({ message: 'Não autenticado.' });
  const row = await getMyDecklist(Number(req.params.id), currentActor.id);
  if (!row) return res.status(404).json({ message: 'Decklist não enviada.' });
  return res.json(row);
};

exports.getMatches = async (req, res) => {
  await ensureTournamentSchema();
  const matches = await TournamentMatch.findAll({
    where: { tournamentId: Number(req.params.id) },
    include: [
      { model: Registration, as: 'playerA' },
      { model: Registration, as: 'playerB' },
      { model: Registration, as: 'winner' }
    ],
    order: [['roundNumber', 'ASC'], ['tableNumber', 'ASC']]
  });
  return res.json(matches);
};

exports.reportMatch = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const match = await TournamentMatch.findByPk(Number(req.params.matchId));
    if (!match) throw new TournamentError('Partida n?o encontrada.', 404);

    const tournament = await Tournament.findByPk(match.tournamentId);
    if (!tournament) throw new TournamentError('Torneio n?o encontrado.', 404);

    const user = actor(req);
    if (!user) throw new TournamentError('N?o autenticado.', 401);

    const userReg = await Registration.findOne({ where: { tournamentId: tournament.id, userId: user.id } });
    const isOrganizer = isTournamentManager(tournament, user);
    const isPlayer = userReg && isPlayerInMatch(match, userReg.id);
    if (!isOrganizer && !isPlayer) throw new TournamentError('Sem permiss?o.', 403);

    if (!isOrganizer && match.resultStatus === 'REPORTED' && match.resultReportedByRegistrationId && match.resultReportedByRegistrationId !== userReg?.id) {
      throw new TournamentError('Resultado já reportado. Aguarde confirmação ou abra disputa.', 409);
    }

    let scoreA = req.body.scoreA;
    let scoreB = req.body.scoreB;
    let isDraw = req.body.isDraw;
    if (typeof req.body.result === 'string') {
      if (req.body.result === 'a') {
        scoreA = 2;
        scoreB = 0;
        isDraw = false;
      } else if (req.body.result === 'b') {
        scoreA = 0;
        scoreB = 2;
        isDraw = false;
      } else if (req.body.result === 'draw') {
        scoreA = 1;
        scoreB = 1;
        isDraw = true;
      }
    }

    match.scoreA = Number(scoreA);
    match.scoreB = Number(scoreB);
    match.isDraw = Boolean(isDraw);
    if (Number.isNaN(match.scoreA) || Number.isNaN(match.scoreB)) {
      throw new TournamentError('Placar inv?lido.');
    }

    if (match.isDraw) {
      match.winnerRegistrationId = null;
      match.winnerId = null;
    } else if (match.scoreA > match.scoreB) {
      match.winnerRegistrationId = match.playerAId;
      const playerA = await Registration.findByPk(match.playerAId);
      match.winnerId = playerA?.userId || null;
    } else if (match.scoreB > match.scoreA && match.playerBId) {
      match.winnerRegistrationId = match.playerBId;
      const playerB = await Registration.findByPk(match.playerBId);
      match.winnerId = playerB?.userId || null;
    } else {
      throw new TournamentError('Placar inv?lido para definir vencedor.');
    }

    match.resultReportedByRegistrationId = userReg?.id || null;
    match.resultReportedByUserId = user.id;
    match.resultReportedAt = new Date();

    if (isOrganizer) {
      match.resultStatus = 'CONFIRMED';
      match.status = 'confirmed';
      match.resultConfirmedByRegistrationId = userReg?.id || null;
      match.resultConfirmedByUserId = user.id;
      match.resultConfirmedAt = new Date();
    } else {
      match.resultStatus = 'REPORTED';
      match.status = 'pending';
    }

    await match.save();
    if (match.resultStatus === 'CONFIRMED') {
      await updateFromMatches(tournament.id, match.stageId || null);
    }

    return res.json(match);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.confirmMatch = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const user = actor(req);
    if (!user) throw new TournamentError('N?o autenticado.', 401);

    const match = await TournamentMatch.findByPk(Number(req.params.matchId));
    if (!match) throw new TournamentError('Partida n?o encontrada.', 404);

    const tournament = await Tournament.findByPk(match.tournamentId);
    if (!tournament) throw new TournamentError('Torneio n?o encontrado.', 404);

    if (match.resultStatus !== 'REPORTED') {
      throw new TournamentError('A partida precisa estar reportada para confirmar.', 409);
    }

    const isOrganizer = isTournamentManager(tournament, user);
    const userReg = await Registration.findOne({ where: { tournamentId: tournament.id, userId: user.id } });
    const isPlayer = userReg && isPlayerInMatch(match, userReg.id);
    const isOpponentConfirmer = isPlayer && userReg.id !== match.resultReportedByRegistrationId;

    if (!isOrganizer && !isOpponentConfirmer) {
      throw new TournamentError('Sem permiss?o para confirmar este resultado.', 403);
    }

    match.resultStatus = 'CONFIRMED';
    match.status = 'confirmed';
    match.resultConfirmedByRegistrationId = userReg?.id || null;
    match.resultConfirmedByUserId = user.id;
    match.resultConfirmedAt = new Date();

    await match.save();
    await updateFromMatches(tournament.id, match.stageId || null);
    return res.json(match);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.disputeMatch = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const match = await TournamentMatch.findByPk(Number(req.params.matchId));
    if (!match) throw new TournamentError('Partida não encontrada.', 404);
    match.resultStatus = 'DISPUTED';
    await match.save();
    return res.json(match);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getStandings = async (req, res) => {
  await ensureTournamentSchema();
  const standings = await getStandings(Number(req.params.id));
  return res.json(standings);
};

exports.getStages = async (req, res) => {
  await ensureTournamentSchema();
  const stages = await TournamentStage.findAll({
    where: { tournamentId: Number(req.params.id) },
    order: [['createdAt', 'ASC']]
  });
  return res.json(stages);
};

exports.generateRound = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const tournament = await Tournament.findByPk(Number(req.params.id));
    if (!tournament) throw new TournamentError('Torneio não encontrado.', 404);
    const user = actor(req);
    if (!(user.accountType === 'admin' || tournament.organizerId === user.id)) throw new TournamentError('Sem permissão.', 403);
    const result = await generateMatchesForFormat(tournament);
    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.generateTopCut = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const result = await createTopCut(Number(req.params.id), actor(req), Number(req.body.size || 8), requestMeta(req));
    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getAuditLogs = async (req, res) => {
  await ensureTournamentSchema();
  const user = actor(req);
  if (!user || user.accountType !== 'admin') return res.status(403).json({ message: 'Sem permissão.' });
  const AuditLog = require('../models/AuditLog');
  const rows = await AuditLog.findAll({
    limit: Number(req.query.limit || 100),
    order: [['createdAt', 'DESC']]
  });
  return res.json(rows);
};

exports.getMyTournamentRegistrationsPageData = async (req, res) => {
  await ensureTournamentSchema();
  const currentActor = actor(req);
  if (!currentActor) {
    req.flash('error_msg', 'Faça login para ver suas inscrições.');
    return res.redirect('/login');
  }
  const rows = await Registration.findAll({
    where: { userId: currentActor.id },
    include: [{ model: Tournament, as: 'tournament' }],
    order: [['createdAt', 'DESC']]
  });
  return res.render('pages/tournaments/my-registrations', {
    title: 'Minhas inscrições em torneios',
    rows
  });
};

exports.getTournamentDashboardData = async (req, res) => {
  await ensureTournamentSchema();
  const tournamentId = Number(req.params.id);
  await autoSyncCheckInWindow(tournamentId, requestMeta(req));
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) {
    req.flash('error_msg', 'Torneio não encontrado.');
    return res.redirect('/tournaments');
  }
  const user = actor(req);
  if (!isTournamentManager(tournament, user)) {
    req.flash('error_msg', 'Sem permissão para gerenciar este torneio.');
    return res.redirect('/tournaments');
  }

  const registrations = await Registration.findAll({
    where: { tournamentId },
    include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }],
    order: [['createdAt', 'ASC']]
  });
  const payments = await TournamentPayment.findAll({ where: { tournamentId }, order: [['createdAt', 'DESC']] });
  const storeCreditStores = await User.findAll({
    where: { accountType: ['store', 'partner_store'] },
    attributes: ['id', 'username', 'businessName'],
    order: [['businessName', 'ASC'], ['username', 'ASC']]
  });
  return res.render('pages/tournaments/manage', {
    title: `Gerenciar ${tournament.title}`,
    tournament: normalizeTournamentForView(tournament),
    registrations,
    payments,
    storeCreditStores
  });
};

exports.manualSwissRound = async (req, res) => {
  await ensureTournamentSchema();
  try {
    const tournament = await Tournament.findByPk(Number(req.params.id));
    if (!tournament) throw new TournamentError('Torneio não encontrado.', 404);
    const user = actor(req);
    if (!(user.accountType === 'admin' || tournament.organizerId === user.id)) throw new TournamentError('Sem permissão.', 403);
    const result = await generateSwissRound(tournament);
    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
};
