const Tournament = require('../models/Tournament');
const TournamentParticipant = require('../models/TournamentParticipant');
const TournamentMatch = require('../models/TournamentMatch');
const User = require('../models/User');
const { sequelize } = require('../database/connection');

let tournamentSchemaChecked = false;
async function ensureTournamentSchema() {
  if (tournamentSchemaChecked) return;
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable('tournaments');
  if (!table.bannerUrl) {
    await qi.addColumn('tournaments', 'bannerUrl', {
      type: require('sequelize').DataTypes.STRING,
      allowNull: true
    });
  }
  tournamentSchemaChecked = true;
}

function isAdmin(req) {
  return req.session?.user?.accountType === 'admin';
}

async function recalcStandings(tournamentId) {
  const participants = await TournamentParticipant.findAll({ where: { tournamentId } });
  const byId = new Map();
  participants.forEach((p) => {
    p.wins = 0;
    p.losses = 0;
    p.draws = 0;
    p.points = 0;
    byId.set(p.id, p);
  });

  const matches = await TournamentMatch.findAll({
    where: { tournamentId, status: 'confirmed' }
  });

  matches.forEach((m) => {
    const a = byId.get(m.playerAId);
    const b = m.playerBId ? byId.get(m.playerBId) : null;
    if (!a) return;

    // Bye
    if (!b) {
      a.wins += 1;
      a.points += 3;
      return;
    }

    if (m.isDraw) {
      a.draws += 1;
      b.draws += 1;
      a.points += 1;
      b.points += 1;
      return;
    }

    if (m.winnerId === a.id) {
      a.wins += 1;
      b.losses += 1;
      a.points += 3;
    } else if (m.winnerId === b.id) {
      b.wins += 1;
      a.losses += 1;
      b.points += 3;
    }
  });

  await Promise.all(participants.map((p) => p.save()));
}

exports.listPage = async (req, res) => {
  await ensureTournamentSchema();
  const tournaments = await Tournament.findAll({
    include: [{ model: User, as: 'organizer', attributes: ['id', 'username'] }],
    order: [['createdAt', 'DESC']]
  });

  const official = tournaments.filter((t) => t.scope === 'official');
  const community = tournaments.filter((t) => t.scope === 'community');

  res.render('pages/tournaments/index', {
    title: 'Torneios',
    official,
    community
  });
};

exports.createPage = async (req, res) => {
  await ensureTournamentSchema();
  res.render('pages/tournaments/create', {
    title: 'Criar Torneio'
  });
};

exports.create = async (req, res) => {
  try {
    await ensureTournamentSchema();
    const { title, description, format, maxPlayers, startAt, rules, scope, bannerUrl } = req.body;
    if (!startAt) {
      req.flash('error_msg', 'A data de início é obrigatória.');
      return res.redirect('/tournaments/create');
    }
    const requestedScope = scope === 'official' ? 'official' : 'community';
    const finalScope = requestedScope === 'official' && isAdmin(req) ? 'official' : 'community';
    const uploadedBanner = req.file ? `/uploads/tournaments/${req.file.filename}` : null;
    const finalBannerUrl = uploadedBanner || (bannerUrl || '').trim() || null;

    const tournament = await Tournament.create({
      title: (title || '').trim(),
      description: (description || '').trim(),
      format: format === 'single_elimination' ? 'single_elimination' : 'swiss',
      maxPlayers: Number(maxPlayers) > 1 ? Number(maxPlayers) : 16,
      startAt,
      rules: (rules || '').trim(),
      bannerUrl: finalBannerUrl,
      scope: finalScope,
      status: 'open',
      createdById: req.session.user.id
    });

    req.flash('success_msg', 'Torneio criado com sucesso.');
    res.redirect(`/tournaments/${tournament.id}`);
  } catch (error) {
    console.error('Erro ao criar torneio:', error);
    req.flash('error_msg', 'Erro ao criar torneio.');
    res.redirect('/tournaments/create');
  }
};

exports.detailPage = async (req, res) => {
  await ensureTournamentSchema();
  const tournamentId = Number(req.params.id);
  const tournament = await Tournament.findByPk(tournamentId, {
    include: [{ model: User, as: 'organizer', attributes: ['id', 'username'] }]
  });

  if (!tournament) {
    req.flash('error_msg', 'Torneio não encontrado.');
    return res.redirect('/tournaments');
  }

  const participants = await TournamentParticipant.findAll({
    where: { tournamentId },
    include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }],
    order: [['points', 'DESC'], ['wins', 'DESC'], ['displayName', 'ASC']]
  });

  const matches = await TournamentMatch.findAll({
    where: { tournamentId },
    include: [
      { model: TournamentParticipant, as: 'playerA' },
      { model: TournamentParticipant, as: 'playerB' },
      { model: TournamentParticipant, as: 'winner' }
    ],
    order: [['roundNumber', 'DESC'], ['tableNumber', 'ASC']]
  });

  const groupedMatches = matches.reduce((acc, m) => {
    acc[m.roundNumber] = acc[m.roundNumber] || [];
    acc[m.roundNumber].push(m);
    return acc;
  }, {});

  const userId = req.session?.user?.id;
  const myEntry = userId ? participants.find((p) => p.userId === userId) : null;
  const canManage = userId && (tournament.createdById === userId || isAdmin(req));

  res.render('pages/tournaments/detail', {
    title: tournament.title,
    tournament,
    participants,
    groupedMatches,
    myEntry,
    canManage
  });
};

exports.join = async (req, res) => {
  await ensureTournamentSchema();
  const tournamentId = Number(req.params.id);
  const userId = req.session.user.id;
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) return res.status(404).json({ message: 'Torneio não encontrado.' });

  if (tournament.status !== 'open') {
    return res.status(400).json({ message: 'Inscrições encerradas para este torneio.' });
  }

  const existing = await TournamentParticipant.findOne({ where: { tournamentId, userId } });
  if (existing) return res.status(400).json({ message: 'Você já está inscrito.' });

  const count = await TournamentParticipant.count({ where: { tournamentId } });
  if (count >= tournament.maxPlayers) {
    return res.status(400).json({ message: 'Torneio lotado.' });
  }

  const user = await User.findByPk(userId, { attributes: ['username'] });
  await TournamentParticipant.create({
    tournamentId,
    userId,
    displayName: user?.username || `Jogador ${userId}`
  });

  return res.json({ ok: true });
};

exports.startNextRound = async (req, res) => {
  await ensureTournamentSchema();
  const tournamentId = Number(req.params.id);
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) return res.status(404).json({ message: 'Torneio não encontrado.' });

  const userId = req.session.user.id;
  if (!(tournament.createdById === userId || isAdmin(req))) {
    return res.status(403).json({ message: 'Sem permissão para gerenciar torneio.' });
  }

  const pending = await TournamentMatch.count({ where: { tournamentId, status: 'pending' } });
  if (pending > 0) return res.status(400).json({ message: 'Existem partidas pendentes.' });

  await recalcStandings(tournamentId);

  const participants = await TournamentParticipant.findAll({
    where: { tournamentId, status: ['registered', 'checked_in'] },
    order: [['points', 'DESC'], ['wins', 'DESC'], ['id', 'ASC']]
  });

  if (participants.length < 2) return res.status(400).json({ message: 'Participantes insuficientes.' });

  const maxRound = await TournamentMatch.max('roundNumber', { where: { tournamentId } });
  const nextRound = Number.isFinite(maxRound) ? maxRound + 1 : 1;

  const shuffled = [...participants];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const ordered = shuffled.sort((a, b) => b.points - a.points || b.wins - a.wins);
  const matches = [];
  let tableNumber = 1;
  for (let i = 0; i < ordered.length; i += 2) {
    const a = ordered[i];
    const b = ordered[i + 1] || null;
    matches.push({
      tournamentId,
      roundNumber: nextRound,
      tableNumber: tableNumber++,
      playerAId: a.id,
      playerBId: b ? b.id : null,
      winnerId: b ? null : a.id,
      isDraw: false,
      status: b ? 'pending' : 'confirmed'
    });
  }

  await TournamentMatch.bulkCreate(matches);
  if (tournament.status === 'open') {
    tournament.status = 'in_progress';
    await tournament.save();
  }

  await recalcStandings(tournamentId);
  return res.json({ ok: true, round: nextRound, matches: matches.length });
};

exports.reportMatch = async (req, res) => {
  await ensureTournamentSchema();
  const matchId = Number(req.params.matchId);
  const { result } = req.body;

  const match = await TournamentMatch.findByPk(matchId, {
    include: [{ model: Tournament, as: 'tournament' }]
  });
  if (!match) return res.status(404).json({ message: 'Partida não encontrada.' });

  const tournament = match.tournament;
  const userId = req.session.user.id;

  const userParticipant = await TournamentParticipant.findOne({
    where: { tournamentId: tournament.id, userId }
  });

  const canManage = tournament.createdById === userId || isAdmin(req);
  const canReportAsPlayer = userParticipant && [match.playerAId, match.playerBId].includes(userParticipant.id);
  if (!canManage && !canReportAsPlayer) {
    return res.status(403).json({ message: 'Sem permissão para reportar esta partida.' });
  }

  if (result === 'draw') {
    match.isDraw = true;
    match.winnerId = null;
  } else if (result === 'a') {
    match.isDraw = false;
    match.winnerId = match.playerAId;
  } else if (result === 'b' && match.playerBId) {
    match.isDraw = false;
    match.winnerId = match.playerBId;
  } else {
    return res.status(400).json({ message: 'Resultado inválido.' });
  }

  match.status = 'confirmed';
  await match.save();
  await recalcStandings(tournament.id);

  return res.json({ ok: true });
};
