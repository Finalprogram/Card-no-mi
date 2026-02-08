const Registration = require('../../models/Registration');
const Tournament = require('../../models/Tournament');
const User = require('../../models/User');
const TournamentPayment = require('../../models/TournamentPayment');
const { TournamentError } = require('./errors');
const { evaluateRefundPolicy } = require('./policyService');
const paymentService = require('./paymentService');
const { logAction } = require('./auditService');

async function activeRegistrationCount(tournamentId) {
  return Registration.count({
    where: {
      tournamentId,
      status: ['PENDING', 'CONFIRMED', 'CHECKED_IN']
    }
  });
}

async function registerPlayer({ tournamentId, playerId, actorId, reqMeta }) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) throw new TournamentError('Torneio não encontrado.', 404);
  const tournamentStatus = String(tournament.status || '').toLowerCase();
  if (!['open'].includes(tournamentStatus)) {
    throw new TournamentError('Inscrições não estão abertas para este torneio.');
  }
  const now = Date.now();
  if (tournament.registrationOpenAt && now < new Date(tournament.registrationOpenAt).getTime()) {
    throw new TournamentError('As inscrições ainda não abriram para este torneio.');
  }
  if (tournament.registrationCloseAt && now > new Date(tournament.registrationCloseAt).getTime()) {
    throw new TournamentError('O prazo de inscrição deste torneio já foi encerrado.');
  }

  const existing = await Registration.findOne({
    where: {
      tournamentId,
      userId: playerId,
      status: ['PENDING', 'CONFIRMED', 'WAITING_LIST', 'CHECKED_IN']
    }
  });
  if (existing) throw new TournamentError('Você já está inscrito neste torneio.');

  const user = await User.findByPk(playerId, { attributes: ['username'] });
  const count = await activeRegistrationCount(tournamentId);
  const hasSeat = count < tournament.capacity;
  if (!hasSeat && !tournament.allowWaitlist) {
    throw new TournamentError('Torneio lotado e sem lista de espera.');
  }

  const entryType = tournament.entryType;
  const registration = await Registration.create({
    tournamentId,
    userId: playerId,
    displayName: user?.username || `Player ${playerId}`,
    status: hasSeat ? (entryType === 'PAID' ? 'PENDING' : 'CONFIRMED') : 'WAITING_LIST',
    type: entryType
  });

  await logAction({
    actorId,
    entityType: 'REGISTRATION',
    entityId: registration.id,
    action: 'REGISTER',
    after: registration.toJSON(),
    ip: reqMeta?.ip,
    userAgent: reqMeta?.userAgent
  });

  if (hasSeat && entryType === 'PAID') {
    const payment = await paymentService.createCharge({
      tournamentId,
      registrationId: registration.id,
      playerId,
      provider: 'PIX',
      actorId,
      reqMeta
    });
    return { registration, payment };
  }

  return { registration };
}

async function promoteFromWaitlist(tournamentId, actorId, reqMeta) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) return null;

  const count = await activeRegistrationCount(tournamentId);
  if (count >= tournament.capacity) return null;

  const candidate = await Registration.findOne({
    where: { tournamentId, status: 'WAITING_LIST' },
    order: [['createdAt', 'ASC']]
  });
  if (!candidate) return null;

  const before = candidate.toJSON();
  candidate.status = candidate.type === 'PAID' ? 'PENDING' : 'CONFIRMED';
  await candidate.save();

  await logAction({
    actorId,
    entityType: 'REGISTRATION',
    entityId: candidate.id,
    action: 'PROMOTE_WAITLIST',
    before,
    after: candidate.toJSON(),
    ip: reqMeta?.ip,
    userAgent: reqMeta?.userAgent
  });

  if (candidate.type === 'PAID') {
    await paymentService.createCharge({
      tournamentId,
      registrationId: candidate.id,
      playerId: candidate.userId,
      provider: 'PIX',
      actorId,
      reqMeta
    });
  }
  return candidate;
}

async function cancelRegistration({ tournamentId, playerId, actorId, reqMeta }) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) throw new TournamentError('Torneio não encontrado.', 404);
  const registration = await Registration.findOne({
    where: { tournamentId, userId: playerId, status: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'WAITING_LIST'] }
  });
  if (!registration) throw new TournamentError('Inscrição ativa não encontrada.', 404);

  const before = registration.toJSON();
  registration.status = 'CANCELLED';
  await registration.save();

  if (registration.type === 'PAID') {
    const payment = await TournamentPayment.findOne({
      where: { registrationId: registration.id, status: 'PAID' },
      order: [['createdAt', 'DESC']]
    });
    if (payment) {
      const policy = evaluateRefundPolicy(tournament);
      if (policy.allowed) {
        await paymentService.refundCharge({
          paymentId: payment.id,
          amountPercent: policy.percent,
          actorId,
          reqMeta
        });
      }
    }
  }

  await logAction({
    actorId,
    entityType: 'REGISTRATION',
    entityId: registration.id,
    action: 'CANCEL_REGISTRATION',
    before,
    after: registration.toJSON(),
    ip: reqMeta?.ip,
    userAgent: reqMeta?.userAgent
  });

  await promoteFromWaitlist(tournamentId, actorId, reqMeta);
  return registration;
}

async function checkInPlayer({ tournamentId, playerId, actorId, reqMeta }) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) throw new TournamentError('Torneio nÃ£o encontrado.', 404);
  const now = Date.now();
  if (tournament.registrationOpenAt && now < new Date(tournament.registrationOpenAt).getTime()) {
    throw new TournamentError('Check-in ainda nÃ£o abriu para este torneio.');
  }
  if (tournament.registrationCloseAt && now > new Date(tournament.registrationCloseAt).getTime()) {
    throw new TournamentError('Check-in encerrado para este torneio.');
  }

  const registration = await Registration.findOne({
    where: { tournamentId, userId: playerId, status: ['CONFIRMED', 'PENDING'] }
  });
  if (!registration) throw new TournamentError('Inscrição não apta para check-in.', 404);
  if (registration.status === 'PENDING') {
    throw new TournamentError('Pagamento pendente. Check-in indisponível.');
  }

  const before = registration.toJSON();
  registration.status = 'CHECKED_IN';
  registration.checkInAt = new Date();
  await registration.save();

  await logAction({
    actorId,
    entityType: 'REGISTRATION',
    entityId: registration.id,
    action: 'CHECKIN',
    before,
    after: registration.toJSON(),
    ip: reqMeta?.ip,
    userAgent: reqMeta?.userAgent
  });
  return registration;
}

async function dropPlayer({ tournamentId, playerId, actorId, reqMeta }) {
  const registration = await Registration.findOne({
    where: { tournamentId, userId: playerId, status: ['CHECKED_IN', 'CONFIRMED'] }
  });
  if (!registration) throw new TournamentError('Participante não encontrado para drop.', 404);

  const before = registration.toJSON();
  registration.status = 'DROPPED';
  await registration.save();
  await logAction({
    actorId,
    entityType: 'REGISTRATION',
    entityId: registration.id,
    action: 'DROP_PLAYER',
    before,
    after: registration.toJSON(),
    ip: reqMeta?.ip,
    userAgent: reqMeta?.userAgent
  });
  return registration;
}

module.exports = {
  registerPlayer,
  cancelRegistration,
  checkInPlayer,
  dropPlayer,
  promoteFromWaitlist
};
