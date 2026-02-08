function getHoursUntilStart(startAt) {
  if (!startAt) return Number.POSITIVE_INFINITY;
  const ms = new Date(startAt).getTime() - Date.now();
  return ms / (1000 * 60 * 60);
}

function evaluateRefundPolicy(tournament) {
  const cfg = tournament.policyConfig || {};
  const fullRefundHoursBeforeStart = Number(cfg.fullRefundHoursBeforeStart ?? 24);
  const partialRefundHoursBeforeStart = Number(cfg.partialRefundHoursBeforeStart ?? 2);
  const partialRefundPercentHoursBeforeStart = Number(cfg.partialRefundPercentHoursBeforeStart ?? 50);
  const allowRefundAfterStart = Boolean(cfg.allowRefundAfterStart ?? false);

  const hoursUntilStart = getHoursUntilStart(tournament.startAt);
  if (hoursUntilStart >= fullRefundHoursBeforeStart) {
    return { allowed: true, percent: 100, reason: 'FULL_BEFORE_WINDOW' };
  }
  if (hoursUntilStart >= partialRefundHoursBeforeStart) {
    return { allowed: true, percent: partialRefundPercentHoursBeforeStart, reason: 'PARTIAL_BEFORE_WINDOW' };
  }
  if (hoursUntilStart < 0 && !allowRefundAfterStart) {
    return { allowed: false, percent: 0, reason: 'AFTER_START_NO_REFUND' };
  }
  if (hoursUntilStart < partialRefundHoursBeforeStart) {
    return { allowed: false, percent: 0, reason: 'TOO_LATE' };
  }
  return { allowed: true, percent: 100, reason: 'DEFAULT' };
}

function getCheckInWindow(tournament) {
  const cfg = tournament.policyConfig || {};
  const openMinutesBeforeStart = Number(cfg.checkInOpenMinutesBeforeStart ?? 60);
  const closeMinutesBeforeStart = Number(cfg.checkInCloseMinutesBeforeStart ?? 10);
  const start = new Date(tournament.startAt).getTime();
  return {
    openAt: new Date(start - openMinutesBeforeStart * 60 * 1000),
    closeAt: new Date(start - closeMinutesBeforeStart * 60 * 1000)
  };
}

module.exports = {
  evaluateRefundPolicy,
  getCheckInWindow
};

