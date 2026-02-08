const { isPlayerInMatch, canConfirmReportedResult } = require('../../src/services/tournaments/matchResultService');

describe('matchResultService', () => {
  const match = {
    playerAId: 10,
    playerBId: 20,
    resultReportedByRegistrationId: 10
  };

  test('identifica jogador na partida', () => {
    expect(isPlayerInMatch(match, 10)).toBe(true);
    expect(isPlayerInMatch(match, 20)).toBe(true);
    expect(isPlayerInMatch(match, 30)).toBe(false);
  });

  test('somente oponente pode confirmar quando não é staff', () => {
    expect(canConfirmReportedResult({
      isOrganizer: false,
      userRegistrationId: 20,
      match
    })).toBe(true);

    expect(canConfirmReportedResult({
      isOrganizer: false,
      userRegistrationId: 10,
      match
    })).toBe(false);
  });

  test('staff pode confirmar sempre', () => {
    expect(canConfirmReportedResult({
      isOrganizer: true,
      userRegistrationId: null,
      match
    })).toBe(true);
  });
});

