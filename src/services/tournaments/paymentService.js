const crypto = require('crypto');
const TournamentPayment = require('../../models/TournamentPayment');
const Registration = require('../../models/Registration');
const Tournament = require('../../models/Tournament');
const { TournamentError } = require('./errors');
const { logAction } = require('./auditService');

function buildProviderChargeId(provider, registrationId) {
  const token = crypto.randomBytes(8).toString('hex');
  return `TRN-${provider}-${registrationId}-${token}`;
}

async function markRegistrationByPayment(payment) {
  const registration = await Registration.findByPk(payment.registrationId);
  if (!registration) return;
  if (payment.status === 'PAID' && registration.status === 'PENDING') {
    registration.status = 'CONFIRMED';
    await registration.save();
  }
  if (['FAILED', 'CANCELLED', 'REFUNDED'].includes(payment.status) && registration.status === 'PENDING') {
    registration.status = 'CANCELLED';
    await registration.save();
  }
}

async function createCharge({ tournamentId, registrationId, playerId, provider = 'PIX', actorId, reqMeta }) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) throw new TournamentError('Torneio não encontrado.', 404);
  if (tournament.entryType !== 'PAID') throw new TournamentError('Este torneio não exige pagamento.');

  const existing = await TournamentPayment.findOne({
    where: { registrationId, status: ['WAITING_PAYMENT', 'PAID'] },
    order: [['createdAt', 'DESC']]
  });
  if (existing) return existing;

  const amountCents = tournament.entryFeeCents;
  const payment = await TournamentPayment.create({
    tournamentId,
    registrationId,
    playerId,
    provider,
    status: provider === 'BALANCE' ? 'PAID' : 'WAITING_PAYMENT',
    providerChargeId: buildProviderChargeId(provider, registrationId),
    amountCents,
    paidAt: provider === 'BALANCE' ? new Date() : null,
    metadata: { mock: true, checkoutUrl: `/tournaments/${tournamentId}` }
  });

  await markRegistrationByPayment(payment);
  await logAction({
    actorId,
    entityType: 'PAYMENT',
    entityId: payment.id,
    action: 'CREATE_CHARGE',
    after: payment.toJSON(),
    ip: reqMeta?.ip,
    userAgent: reqMeta?.userAgent
  });
  return payment;
}

async function handleWebhook(payload, reqMeta = {}) {
  const providerChargeId = payload.providerChargeId || payload.id || payload.charge_id;
  if (!providerChargeId) throw new TournamentError('Webhook sem providerChargeId.', 400);

  const normalizedStatus = String(payload.status || '').toUpperCase();
  const map = {
    PAID: 'PAID',
    APPROVED: 'PAID',
    SUCCESS: 'PAID',
    FAILED: 'FAILED',
    ERROR: 'FAILED',
    REFUNDED: 'REFUNDED',
    CANCELLED: 'CANCELLED'
  };
  const newStatus = map[normalizedStatus] || 'WAITING_PAYMENT';

  const payment = await TournamentPayment.findOne({ where: { providerChargeId } });
  if (!payment) throw new TournamentError('Pagamento não encontrado para webhook.', 404);

  const before = payment.toJSON();
  if (payment.status === newStatus && newStatus !== 'WAITING_PAYMENT') {
    return { idempotent: true, payment };
  }

  payment.status = newStatus;
  if (newStatus === 'PAID') payment.paidAt = payment.paidAt || new Date();
  if (newStatus === 'REFUNDED') payment.refundedAt = payment.refundedAt || new Date();
  payment.metadata = { ...(payment.metadata || {}), webhookPayload: payload };
  await payment.save();
  await markRegistrationByPayment(payment);

  await logAction({
    actorId: payload.actorId || payment.playerId,
    entityType: 'PAYMENT',
    entityId: payment.id,
    action: 'WEBHOOK_UPDATE',
    before,
    after: payment.toJSON(),
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });

  return { idempotent: false, payment };
}

async function refundCharge({ paymentId, amountPercent = 100, actorId, reqMeta }) {
  const payment = await TournamentPayment.findByPk(paymentId);
  if (!payment) throw new TournamentError('Pagamento não encontrado.', 404);
  if (payment.status !== 'PAID') throw new TournamentError('Apenas pagamentos pagos podem ser estornados.');

  const before = payment.toJSON();
  payment.status = 'REFUNDED';
  payment.refundedAt = new Date();
  payment.metadata = {
    ...(payment.metadata || {}),
    refundPercent: amountPercent
  };
  await payment.save();
  await markRegistrationByPayment(payment);

  await logAction({
    actorId,
    entityType: 'PAYMENT',
    entityId: payment.id,
    action: 'REFUND',
    before,
    after: payment.toJSON(),
    ip: reqMeta?.ip,
    userAgent: reqMeta?.userAgent
  });
  return payment;
}

module.exports = {
  createCharge,
  handleWebhook,
  refundCharge
};

