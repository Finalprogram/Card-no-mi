const { evaluateRefundPolicy, getCheckInWindow } = require('../../src/services/tournaments/policyService');

describe('policyService', () => {
  test('reembolso total antes da janela', () => {
    const tournament = {
      startAt: new Date(Date.now() + (48 * 60 * 60 * 1000)),
      policyConfig: { fullRefundHoursBeforeStart: 24 }
    };
    const result = evaluateRefundPolicy(tournament);
    expect(result.allowed).toBe(true);
    expect(result.percent).toBe(100);
  });

  test('sem reembolso após início por padrão', () => {
    const tournament = {
      startAt: new Date(Date.now() - (1 * 60 * 60 * 1000)),
      policyConfig: { allowRefundAfterStart: false }
    };
    const result = evaluateRefundPolicy(tournament);
    expect(result.allowed).toBe(false);
  });

  test('gera janela de check-in com offsets configuráveis', () => {
    const startAt = new Date(Date.now() + (2 * 60 * 60 * 1000));
    const tournament = {
      startAt,
      policyConfig: {
        checkInOpenMinutesBeforeStart: 60,
        checkInCloseMinutesBeforeStart: 10
      }
    };
    const { openAt, closeAt } = getCheckInWindow(tournament);
    expect(openAt.getTime()).toBe(startAt.getTime() - 60 * 60 * 1000);
    expect(closeAt.getTime()).toBe(startAt.getTime() - 10 * 60 * 1000);
  });
});
