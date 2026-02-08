const Registration = require('../../models/Registration');
const TournamentMatch = require('../../models/TournamentMatch');
const TournamentStage = require('../../models/TournamentStage');
const TournamentStanding = require('../../models/TournamentStanding');
const { TournamentError } = require('./errors');

function swissRoundCountByPlayers(playersCount) {
  if (playersCount <= 8) return 3;
  if (playersCount <= 16) return 4;
  if (playersCount <= 32) return 5;
  if (playersCount <= 64) return 6;
  if (playersCount <= 128) return 7;
  return 8;
}

function topCutPairs(size) {
  if (size === 4) return [[1, 4], [2, 3]];
  if (size === 8) return [[1, 8], [4, 5], [2, 7], [3, 6]];
  if (size === 16) return [[1, 16], [8, 9], [4, 13], [5, 12], [2, 15], [7, 10], [3, 14], [6, 11]];
  return [];
}

async function ensureSwissStage(tournamentId, swissRounds) {
  let stage = await TournamentStage.findOne({ where: { tournamentId, type: 'SWISS' } });
  if (!stage) {
    stage = await TournamentStage.create({
      tournamentId,
      type: 'SWISS',
      status: 'RUNNING',
      settings: { swissRounds }
    });
  }
  return stage;
}


async function ensureStage(tournamentId, type, settings = {}) {
  let stage = await TournamentStage.findOne({ where: { tournamentId, type } });
  if (!stage) {
    stage = await TournamentStage.create({
      tournamentId,
      type,
      status: 'RUNNING',
      settings
    });
  } else if (Object.keys(settings).length > 0) {
    stage.settings = { ...stage.settings, ...settings };
    await stage.save();
  }
  return stage;
}

async function getActiveRegistrations(tournamentId) {
  const participants = await Registration.findAll({
    where: { tournamentId, status: ['CONFIRMED', 'CHECKED_IN', 'DROPPED'] }
  });
  return participants.filter((p) => p.status !== 'DROPPED');
}

async function ensureNoPending(tournamentId, stageId) {
  const pending = await TournamentMatch.count({
    where: { tournamentId, stageId, resultStatus: ['PENDING', 'REPORTED', 'DISPUTED'] }
  });
  if (pending > 0) throw new TournamentError('Ainda existem partidas pendentes nesta fase.');
}

function nextPowerOfTwo(value) {
  let power = 1;
  while (power < value) power *= 2;
  return power;
}

function seededPairs(registrations) {
  const seeds = [...registrations].sort((a, b) => a.id - b.id);
  const bracketSize = nextPowerOfTwo(seeds.length);
  const padded = [...seeds, ...Array.from({ length: bracketSize - seeds.length }).fill(null)];
  const pairs = [];
  for (let i = 0; i < bracketSize / 2; i += 1) {
    const a = padded[i];
    const b = padded[bracketSize - 1 - i];
    pairs.push([a, b]);
  }
  return pairs;
}

function roundRobinRounds(registrations) {
  const players = [...registrations];
  const isOdd = players.length % 2 === 1;
  if (isOdd) players.push(null);
  const rounds = players.length - 1;
  const half = players.length / 2;
  const schedule = [];
  for (let round = 0; round < rounds; round += 1) {
    const pairs = [];
    for (let i = 0; i < half; i += 1) {
      const p1 = players[i];
      const p2 = players[players.length - 1 - i];
      if (p1 && p2) pairs.push([p1, p2]);
    }
    schedule.push(pairs);
    const fixed = players.shift();
    const last = players.pop();
    players.unshift(last);
    players.unshift(fixed);
  }
  return schedule;
}

async function getPlayedOpponents(tournamentId, stageId) {
  const matches = await TournamentMatch.findAll({
    where: { tournamentId, stageId, resultStatus: ['REPORTED', 'CONFIRMED'] }
  });
  const map = new Map();
  const add = (a, b) => {
    if (!a || !b) return;
    if (!map.has(a)) map.set(a, new Set());
    map.get(a).add(b);
  };
  matches.forEach((m) => {
    if (m.playerBId) {
      add(m.playerAId, m.playerBId);
      add(m.playerBId, m.playerAId);
    }
  });
  return map;
}

async function generateSwissRound(tournament, stageId = null) {
  const participants = await Registration.findAll({
    where: { tournamentId: tournament.id, status: ['CONFIRMED', 'CHECKED_IN', 'DROPPED'] }
  });
  const active = participants.filter((p) => p.status !== 'DROPPED');
  if (active.length < 2) throw new TournamentError('Participantes insuficientes para gerar rodada.');

  const swissRounds = tournament.swissRounds || swissRoundCountByPlayers(active.length);
  const stage = stageId ? await TournamentStage.findByPk(stageId) : await ensureSwissStage(tournament.id, swissRounds);
  if (!stage) throw new TournamentError('Stage Swiss não encontrado.', 404);

  const pending = await TournamentMatch.count({
    where: { tournamentId: tournament.id, stageId: stage.id, resultStatus: ['PENDING', 'REPORTED', 'DISPUTED'] }
  });
  if (pending > 0) throw new TournamentError('Ainda existem partidas pendentes nesta fase.');

  const currentMaxRound = await TournamentMatch.max('roundNumber', { where: { tournamentId: tournament.id, stageId: stage.id } });
  const roundNumber = Number.isFinite(currentMaxRound) ? currentMaxRound + 1 : 1;
  if (roundNumber > swissRounds) throw new TournamentError('Todas as rodadas Swiss já foram geradas.');

  const standings = await TournamentStanding.findAll({
    where: { tournamentId: tournament.id, stageId: stage.id },
    order: [['rank', 'ASC']]
  });
  let ordered;
  if (standings.length > 0) {
    const regById = new Map(active.map((p) => [p.id, p]));
    ordered = standings.map((s) => regById.get(s.registrationId)).filter(Boolean);
    const missing = active.filter((p) => !ordered.find((o) => o.id === p.id));
    ordered = [...ordered, ...missing];
  } else {
    ordered = [...active].sort((a, b) => a.id - b.id);
  }

  const alreadyPlayed = await getPlayedOpponents(tournament.id, stage.id);
  const unpaired = [...ordered];
  const byesCount = new Map();
  const historicalByes = await TournamentMatch.findAll({
    where: { tournamentId: tournament.id, stageId: stage.id, playerBId: null }
  });
  historicalByes.forEach((m) => {
    byesCount.set(m.playerAId, (byesCount.get(m.playerAId) || 0) + 1);
  });

  const pairings = [];
  let tableNumber = 1;

  if (unpaired.length % 2 === 1) {
    unpaired.sort((a, b) => (byesCount.get(a.id) || 0) - (byesCount.get(b.id) || 0));
    const byePlayer = unpaired.shift();
    pairings.push({
      tournamentId: tournament.id,
      stageId: stage.id,
      roundNumber,
      tableNumber: tableNumber++,
      playerAId: byePlayer.id,
      playerBId: null,
      winnerRegistrationId: byePlayer.id,
      winnerId: byePlayer.userId,
      scoreA: 2,
      scoreB: 0,
      resultStatus: 'CONFIRMED',
      status: 'confirmed'
    });
  }

  while (unpaired.length > 1) {
    const playerA = unpaired.shift();
    let opponentIndex = unpaired.findIndex((candidate) => !alreadyPlayed.get(playerA.id)?.has(candidate.id));
    if (opponentIndex === -1) opponentIndex = 0;
    const playerB = unpaired.splice(opponentIndex, 1)[0];

    pairings.push({
      tournamentId: tournament.id,
      stageId: stage.id,
      roundNumber,
      tableNumber: tableNumber++,
      playerAId: playerA.id,
      playerBId: playerB.id,
      winnerRegistrationId: null,
      winnerId: null,
      scoreA: null,
      scoreB: null,
      resultStatus: 'PENDING',
      status: 'pending'
    });
  }

  await TournamentMatch.bulkCreate(pairings);
  return { roundNumber, stageId: stage.id, pairingsCount: pairings.length };
}

async function generateTopCutBracket(tournament, size = 8) {
  if (![4, 8, 16].includes(size)) throw new TournamentError('Top Cut inválido.');
  const swissStage = await TournamentStage.findOne({ where: { tournamentId: tournament.id, type: 'SWISS' } });
  if (!swissStage) throw new TournamentError('Torneio sem fase Swiss.');

  const standings = await TournamentStanding.findAll({
    where: { tournamentId: tournament.id, stageId: swissStage.id },
    order: [['rank', 'ASC']]
  });
  if (standings.length < size) throw new TournamentError('Participantes insuficientes para top cut.');

  const seeds = standings.slice(0, size);
  let stage = await TournamentStage.findOne({ where: { tournamentId: tournament.id, type: 'TOP_CUT' } });
  if (!stage) {
    stage = await TournamentStage.create({
      tournamentId: tournament.id,
      type: 'TOP_CUT',
      status: 'RUNNING',
      settings: { size }
    });
  }

  const pairs = topCutPairs(size);
  const matches = pairs.map((pair, idx) => {
    const aSeed = seeds[pair[0] - 1];
    const bSeed = seeds[pair[1] - 1];
    return {
      tournamentId: tournament.id,
      stageId: stage.id,
      roundNumber: 1,
      tableNumber: idx + 1,
      playerAId: aSeed.registrationId,
      playerBId: bSeed.registrationId,
      resultStatus: 'PENDING',
      status: 'pending'
    };
  });

  await TournamentMatch.destroy({ where: { tournamentId: tournament.id, stageId: stage.id } });
  await TournamentMatch.bulkCreate(matches);
  return { stageId: stage.id, matches: matches.length };
}


async function generateSingleElim(tournament) {
  const stage = await ensureStage(tournament.id, 'CUSTOM', { formatType: 'SINGLE_ELIM' });
  await ensureNoPending(tournament.id, stage.id);

  const currentMaxRound = await TournamentMatch.max('roundNumber', { where: { tournamentId: tournament.id, stageId: stage.id } });
  const roundNumber = Number.isFinite(currentMaxRound) ? currentMaxRound + 1 : 1;

  let participants;
  if (roundNumber === 1) {
    participants = await getActiveRegistrations(tournament.id);
  } else {
    const prevMatches = await TournamentMatch.findAll({ where: { tournamentId: tournament.id, stageId: stage.id, roundNumber: roundNumber - 1 } });
    if (prevMatches.some((m) => m.resultStatus !== 'CONFIRMED')) {
      throw new TournamentError('Finalize a rodada anterior antes de gerar a proxima.');
    }
    const winners = prevMatches.map((m) => m.winnerRegistrationId).filter(Boolean);
    participants = await Registration.findAll({ where: { id: winners } });
  }

  if (participants.length < 2) throw new TournamentError('Participantes insuficientes para gerar rodada.');

  const pairs = seededPairs(participants);
  let tableNumber = 1;
  const matches = pairs.map(([a, b]) => {
    if (a && !b) {
      return {
        tournamentId: tournament.id,
        stageId: stage.id,
        roundNumber,
        tableNumber: tableNumber++,
        playerAId: a.id,
        playerBId: null,
        winnerRegistrationId: a.id,
        winnerId: a.userId,
        scoreA: 2,
        scoreB: 0,
        resultStatus: 'CONFIRMED',
        status: 'confirmed'
      };
    }
    return {
      tournamentId: tournament.id,
      stageId: stage.id,
      roundNumber,
      tableNumber: tableNumber++,
      playerAId: a.id,
      playerBId: b.id,
      resultStatus: 'PENDING',
      status: 'pending'
    };
  });

  await TournamentMatch.bulkCreate(matches);
  return { roundNumber, stageId: stage.id, pairingsCount: matches.length };
}

async function generateDoubleElim(tournament) {
  const winnersStage = await ensureStage(tournament.id, 'CUSTOM', { formatType: 'DOUBLE_ELIM', bracket: 'WINNERS' });
  const losersStage = await ensureStage(tournament.id, 'CUSTOM', { formatType: 'DOUBLE_ELIM', bracket: 'LOSERS' });

  await ensureNoPending(tournament.id, winnersStage.id);
  await ensureNoPending(tournament.id, losersStage.id);

  const losses = new Map();
  const allConfirmed = await TournamentMatch.findAll({
    where: { tournamentId: tournament.id, resultStatus: 'CONFIRMED' }
  });
  allConfirmed.forEach((m) => {
    if (!m.playerBId) return;
    if (m.winnerRegistrationId && m.playerAId && m.playerBId) {
      const loser = m.winnerRegistrationId === m.playerAId ? m.playerBId : m.playerAId;
      losses.set(loser, (losses.get(loser) || 0) + 1);
    }
  });

  const active = await getActiveRegistrations(tournament.id);
  const winnersActive = active.filter((p) => (losses.get(p.id) || 0) === 0);
  const losersActive = active.filter((p) => (losses.get(p.id) || 0) === 1);

  const winnersMaxRound = await TournamentMatch.max('roundNumber', { where: { tournamentId: tournament.id, stageId: winnersStage.id } });
  const winnersRound = Number.isFinite(winnersMaxRound) ? winnersMaxRound + 1 : 1;

  if (winnersRound === 1) {
    if (winnersActive.length < 2) throw new TournamentError('Participantes insuficientes para gerar rodada.');
    const pairs = seededPairs(winnersActive);
    let tableNumber = 1;
    const matches = pairs.map(([a, b]) => {
      if (a && !b) {
        return {
          tournamentId: tournament.id,
          stageId: winnersStage.id,
          roundNumber: winnersRound,
          tableNumber: tableNumber++,
          playerAId: a.id,
          playerBId: null,
          winnerRegistrationId: a.id,
          winnerId: a.userId,
          scoreA: 2,
          scoreB: 0,
          resultStatus: 'CONFIRMED',
          status: 'confirmed'
        };
      }
      return {
        tournamentId: tournament.id,
        stageId: winnersStage.id,
        roundNumber: winnersRound,
        tableNumber: tableNumber++,
        playerAId: a.id,
        playerBId: b.id,
        resultStatus: 'PENDING',
        status: 'pending'
      };
    });
    await TournamentMatch.bulkCreate(matches);
    return { roundNumber: winnersRound, stageId: winnersStage.id, pairingsCount: matches.length };
  }

  if (winnersActive.length >= 2) {
    const pairs = seededPairs(winnersActive);
    let tableNumber = 1;
    const matches = pairs.map(([a, b]) => {
      if (a && !b) {
        return {
          tournamentId: tournament.id,
          stageId: winnersStage.id,
          roundNumber: winnersRound,
          tableNumber: tableNumber++,
          playerAId: a.id,
          playerBId: null,
          winnerRegistrationId: a.id,
          winnerId: a.userId,
          scoreA: 2,
          scoreB: 0,
          resultStatus: 'CONFIRMED',
          status: 'confirmed'
        };
      }
      return {
        tournamentId: tournament.id,
        stageId: winnersStage.id,
        roundNumber: winnersRound,
        tableNumber: tableNumber++,
        playerAId: a.id,
        playerBId: b.id,
        resultStatus: 'PENDING',
        status: 'pending'
      };
    });
    await TournamentMatch.bulkCreate(matches);
  }

  if (losersActive.length >= 2) {
    const losersMaxRound = await TournamentMatch.max('roundNumber', { where: { tournamentId: tournament.id, stageId: losersStage.id } });
    const losersRound = Number.isFinite(losersMaxRound) ? losersMaxRound + 1 : 1;
    const pairs = seededPairs(losersActive);
    let tableNumber = 1;
    const matches = pairs.map(([a, b]) => ({
      tournamentId: tournament.id,
      stageId: losersStage.id,
      roundNumber: losersRound,
      tableNumber: tableNumber++,
      playerAId: a.id,
      playerBId: b?.id || null,
      resultStatus: b ? 'PENDING' : 'CONFIRMED',
      status: b ? 'pending' : 'confirmed',
      winnerRegistrationId: b ? null : a.id,
      winnerId: b ? null : a.userId,
      scoreA: b ? null : 2,
      scoreB: b ? null : 0
    }));
    await TournamentMatch.bulkCreate(matches);
    return { roundNumber: losersRound, stageId: losersStage.id, pairingsCount: matches.length };
  }

  if (winnersActive.length === 1 && losersActive.length === 1) {
    const finalRound = winnersRound;
    const existingFinal = await TournamentMatch.findOne({
      where: { tournamentId: tournament.id, stageId: winnersStage.id, roundNumber: finalRound }
    });
    if (!existingFinal) {
      const finalMatch = await TournamentMatch.create({
        tournamentId: tournament.id,
        stageId: winnersStage.id,
        roundNumber: finalRound,
        tableNumber: 1,
        playerAId: winnersActive[0].id,
        playerBId: losersActive[0].id,
        resultStatus: 'PENDING',
        status: 'pending'
      });
      return { roundNumber: finalRound, stageId: winnersStage.id, pairingsCount: 1, matchId: finalMatch.id };
    }
  }

  return { message: 'Nenhuma nova rodada gerada.' };
}

async function generateRoundRobin(tournament, type = 'ROUND_ROBIN') {
  const stage = await ensureStage(tournament.id, type, { formatType: type });
  const existing = await TournamentMatch.count({ where: { tournamentId: tournament.id, stageId: stage.id } });
  if (existing > 0) throw new TournamentError('Rodadas ja geradas para este formato.');
  const participants = await getActiveRegistrations(tournament.id);
  if (participants.length < 2) throw new TournamentError('Participantes insuficientes para gerar rodada.');
  const rounds = roundRobinRounds(participants);
  let tableNumber = 1;
  const matches = [];
  rounds.forEach((pairs, roundIdx) => {
    pairs.forEach(([a, b]) => {
      matches.push({
        tournamentId: tournament.id,
        stageId: stage.id,
        roundNumber: roundIdx + 1,
        tableNumber: tableNumber++,
        playerAId: a.id,
        playerBId: b.id,
        resultStatus: 'PENDING',
        status: 'pending'
      });
    });
  });
  await TournamentMatch.bulkCreate(matches);
  return { stageId: stage.id, rounds: rounds.length, pairingsCount: matches.length };
}

async function generateLeague(tournament) {
  const stage = await ensureStage(tournament.id, 'LEAGUE', { formatType: 'LEAGUE', doubleRound: false });
  const existing = await TournamentMatch.count({ where: { tournamentId: tournament.id, stageId: stage.id } });
  if (existing > 0) throw new TournamentError('Liga ja gerada.');
  const participants = await getActiveRegistrations(tournament.id);
  if (participants.length < 2) throw new TournamentError('Participantes insuficientes para gerar rodada.');
  const rounds = roundRobinRounds(participants);
  let tableNumber = 1;
  const matches = [];
  rounds.forEach((pairs, roundIdx) => {
    pairs.forEach(([a, b]) => {
      matches.push({
        tournamentId: tournament.id,
        stageId: stage.id,
        roundNumber: roundIdx + 1,
        tableNumber: tableNumber++,
        playerAId: a.id,
        playerBId: b.id,
        resultStatus: 'PENDING',
        status: 'pending'
      });
    });
  });
  await TournamentMatch.bulkCreate(matches);
  return { stageId: stage.id, rounds: rounds.length, pairingsCount: matches.length };
}

async function generateGauntlet(tournament) {
  const stage = await ensureStage(tournament.id, 'CUSTOM', { formatType: 'GAUNTLET' });
  await ensureNoPending(tournament.id, stage.id);
  const participants = await getActiveRegistrations(tournament.id);
  if (participants.length < 2) throw new TournamentError('Participantes insuficientes para gerar rodada.');

  const order = stage.settings.order || participants.map((p) => p.id);
  let currentIndex = stage.settings.currentIndex || 1;
  let defenderId = stage.settings.defenderId || order[0];

  const lastMatch = await TournamentMatch.findOne({
    where: { tournamentId: tournament.id, stageId: stage.id },
    order: [['roundNumber', 'DESC']]
  });
  if (lastMatch && lastMatch.resultStatus === 'CONFIRMED' && lastMatch.winnerRegistrationId) {
    defenderId = lastMatch.winnerRegistrationId;
    currentIndex = Math.max(currentIndex, (stage.settings.currentIndex || 1) + 1);
  }

  if (currentIndex >= order.length) throw new TournamentError('Gauntlet finalizado.');
  const challengerId = order[currentIndex];
  const defender = await Registration.findByPk(defenderId);
  const challenger = await Registration.findByPk(challengerId);
  if (!defender || !challenger) throw new TournamentError('Participantes invalidos para gauntlet.');

  const roundNumber = (stage.settings.roundNumber || 0) + 1;
  const match = await TournamentMatch.create({
    tournamentId: tournament.id,
    stageId: stage.id,
    roundNumber,
    tableNumber: 1,
    playerAId: defender.id,
    playerBId: challenger.id,
    resultStatus: 'PENDING',
    status: 'pending'
  });

  stage.settings = {
    ...stage.settings,
    order,
    currentIndex: currentIndex + 1,
    defenderId,
    roundNumber
  };
  await stage.save();
  return { stageId: stage.id, roundNumber, matchId: match.id };
}

async function generateGroupBrackets(tournament) {
  const stage = await ensureStage(tournament.id, 'CUSTOM', { formatType: 'GROUP_BRACKETS' });
  const existing = await TournamentMatch.count({ where: { tournamentId: tournament.id, stageId: stage.id } });
  if (existing > 0) throw new TournamentError('Grupos ja gerados.');
  const participants = await getActiveRegistrations(tournament.id);
  if (participants.length < 4) throw new TournamentError('Participantes insuficientes para grupos.');
  const groupCount = stage.settings.groupCount || (participants.length >= 16 ? 4 : 2);
  const groups = Array.from({ length: groupCount }).map(() => []);
  participants.sort((a, b) => a.id - b.id).forEach((p, idx) => {
    groups[idx % groupCount].push(p);
  });
  stage.settings = { ...stage.settings, groupCount, groups: groups.map((g) => g.map((p) => p.id)) };
  await stage.save();

  let tableNumber = 1;
  const matches = [];
  groups.forEach((group, groupIndex) => {
    const rounds = roundRobinRounds(group);
    rounds.forEach((pairs, roundIdx) => {
      pairs.forEach(([a, b]) => {
        matches.push({
          tournamentId: tournament.id,
          stageId: stage.id,
          roundNumber: roundIdx + 1,
          tableNumber: tableNumber++,
          playerAId: a.id,
          playerBId: b.id,
          resultStatus: 'PENDING',
          status: 'pending',
          notes: `GROUP_${groupIndex + 1}`
        });
      });
    });
  });
  await TournamentMatch.bulkCreate(matches);
  return { stageId: stage.id, groups: groupCount, pairingsCount: matches.length };
}

async function generateCustomBracket(tournament) {
  const stage = await ensureStage(tournament.id, 'CUSTOM', { formatType: 'CUSTOM_BRACKET' });
  const existing = await TournamentMatch.count({ where: { tournamentId: tournament.id, stageId: stage.id } });
  if (existing > 0) throw new TournamentError('Chave personalizada ja gerada.');
  const participants = await getActiveRegistrations(tournament.id);
  if (participants.length < 2) throw new TournamentError('Participantes insuficientes.');
  const pairs = seededPairs(participants);
  let tableNumber = 1;
  const matches = pairs.map(([a, b]) => ({
    tournamentId: tournament.id,
    stageId: stage.id,
    roundNumber: 1,
    tableNumber: tableNumber++,
    playerAId: a.id,
    playerBId: b?.id || null,
    resultStatus: b ? 'PENDING' : 'CONFIRMED',
    status: b ? 'pending' : 'confirmed',
    winnerRegistrationId: b ? null : a.id,
    winnerId: b ? null : a.userId,
    scoreA: b ? null : 2,
    scoreB: b ? null : 0
  }));
  await TournamentMatch.bulkCreate(matches);
  return { stageId: stage.id, pairingsCount: matches.length };
}

async function generateMatchesForFormat(tournament) {
  switch (tournament.formatType) {
    case 'SWISS_TOP_CUT':
      return generateSwissRound(tournament);
    case 'SINGLE_ELIM':
      return generateSingleElim(tournament);
    case 'DOUBLE_ELIM':
      return generateDoubleElim(tournament);
    case 'ROUND_ROBIN':
      return generateRoundRobin(tournament, 'ROUND_ROBIN');
    case 'LEAGUE':
      return generateLeague(tournament);
    case 'GAUNTLET':
      return generateGauntlet(tournament);
    case 'GROUP_BRACKETS':
      return generateGroupBrackets(tournament);
    case 'CUSTOM_BRACKET':
      return generateCustomBracket(tournament);
    default:
      throw new TournamentError('Formato nao suportado.');
  }
}

module.exports = {
  swissRoundCountByPlayers,
  topCutPairs,
  generateSwissRound,
  generateTopCutBracket,
  generateMatchesForFormat,
  generateSingleElim,
  generateDoubleElim,
  generateRoundRobin,
  generateLeague,
  generateGauntlet,
  generateGroupBrackets,
  generateCustomBracket
};

