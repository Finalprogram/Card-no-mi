const Registration = require('../../models/Registration');
const TournamentMatch = require('../../models/TournamentMatch');
const TournamentStanding = require('../../models/TournamentStanding');

function safeRatio(numerator, denominator) {
  if (!denominator || denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

async function updateFromMatches(tournamentId, stageId = null) {
  const participants = await Registration.findAll({
    where: { tournamentId, status: ['CONFIRMED', 'CHECKED_IN', 'DROPPED', 'NO_SHOW'] }
  });

  const participantMap = new Map();
  participants.forEach((p) => {
    participantMap.set(p.id, {
      registration: p,
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0,
      gamesWon: 0,
      gamesPlayed: 0,
      opponents: []
    });
  });

  const where = { tournamentId, resultStatus: 'CONFIRMED' };
  if (stageId) where.stageId = stageId;
  const matches = await TournamentMatch.findAll({ where });

  matches.forEach((m) => {
    const a = participantMap.get(m.playerAId);
    const b = m.playerBId ? participantMap.get(m.playerBId) : null;
    if (!a) return;

    const scoreA = Number(m.scoreA ?? 0);
    const scoreB = Number(m.scoreB ?? 0);
    a.gamesWon += scoreA;
    a.gamesPlayed += scoreA + scoreB;
    if (b) {
      b.gamesWon += scoreB;
      b.gamesPlayed += scoreA + scoreB;
      a.opponents.push(b.registration.id);
      b.opponents.push(a.registration.id);
    }

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

    if (m.winnerRegistrationId === a.registration.id) {
      a.wins += 1;
      a.points += 3;
      b.losses += 1;
    } else if (m.winnerRegistrationId === b.registration.id) {
      b.wins += 1;
      b.points += 3;
      a.losses += 1;
    }
  });

  const all = [...participantMap.values()];
  const matchWinPct = new Map(
    all.map((item) => {
      const totalMatches = item.wins + item.losses + item.draws;
      return [item.registration.id, safeRatio((item.wins * 3) + item.draws, totalMatches * 3 || 1)];
    })
  );
  const gameWinPct = new Map(
    all.map((item) => [item.registration.id, safeRatio(item.gamesWon, item.gamesPlayed || 1)])
  );

  const records = all.map((item) => {
    const omwList = item.opponents.map((opId) => matchWinPct.get(opId) || 0);
    const ogwList = item.opponents.map((opId) => gameWinPct.get(opId) || 0);
    return {
      registrationId: item.registration.id,
      playerId: item.registration.userId,
      points: item.points,
      wins: item.wins,
      losses: item.losses,
      draws: item.draws,
      omw: omwList.length ? safeRatio(omwList.reduce((a, b) => a + b, 0), omwList.length) : 0,
      gw: gameWinPct.get(item.registration.id) || 0,
      ogw: ogwList.length ? safeRatio(ogwList.reduce((a, b) => a + b, 0), ogwList.length) : 0
    };
  });

  records.sort((a, b) => (
    b.points - a.points ||
    b.omw - a.omw ||
    b.gw - a.gw ||
    b.ogw - a.ogw ||
    a.registrationId - b.registrationId
  ));

  await TournamentStanding.destroy({ where: { tournamentId, ...(stageId ? { stageId } : {}) } });
  await TournamentStanding.bulkCreate(records.map((r, idx) => ({
    tournamentId,
    stageId,
    rank: idx + 1,
    ...r
  })));

  return records;
}

async function getStandings(tournamentId, stageId = null) {
  return TournamentStanding.findAll({
    where: { tournamentId, ...(stageId ? { stageId } : {}) },
    order: [['rank', 'ASC']]
  });
}

module.exports = {
  updateFromMatches,
  getStandings
};

