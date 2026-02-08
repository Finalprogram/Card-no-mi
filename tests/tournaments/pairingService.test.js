const { swissRoundCountByPlayers, topCutPairs } = require('../../src/services/tournaments/pairingService');

describe('pairingService', () => {
  test('calcula quantidade de rodadas Swiss por faixa de jogadores', () => {
    expect(swissRoundCountByPlayers(8)).toBe(3);
    expect(swissRoundCountByPlayers(16)).toBe(4);
    expect(swissRoundCountByPlayers(32)).toBe(5);
    expect(swissRoundCountByPlayers(64)).toBe(6);
    expect(swissRoundCountByPlayers(128)).toBe(7);
  });

  test('gera seeds corretos para top cut de 8', () => {
    expect(topCutPairs(8)).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6]
    ]);
  });
});
