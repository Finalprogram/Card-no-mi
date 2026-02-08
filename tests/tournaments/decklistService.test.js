const { validateDecklist } = require('../../src/services/tournaments/decklistService');

describe('decklistService', () => {
  const buildList = (codePrefix, qty, total) => {
    const list = [];
    for (let i = 1; i <= total / qty; i += 1) {
      list.push({ cardId: `${codePrefix}-${i}`, qty });
    }
    return list;
  };

  test('aceita decklist válida de One Piece (50/10)', () => {
    const result = validateDecklist({
      leaderCode: 'OP01-001',
      mainDeck: buildList('OP', 4, 48).concat([{ cardId: 'OP-LAST', qty: 2 }]),
      donDeck: [{ cardId: 'DON-1', qty: 10 }]
    });

    expect(result.main.reduce((acc, c) => acc + c.qty, 0)).toBe(50);
    expect(result.don.reduce((acc, c) => acc + c.qty, 0)).toBe(10);
  });

  test('rejeita decklist com main deck inválido', () => {
    expect(() => validateDecklist({
      leaderCode: 'OP01-001',
      mainDeck: [{ cardId: 'X', qty: 49 }],
      donDeck: [{ cardId: 'DON', qty: 10 }]
    })).toThrow('Main Deck deve ter exatamente 50 cartas.');
  });
});
