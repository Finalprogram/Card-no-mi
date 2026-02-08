class TournamentError extends Error {
  constructor(message, status = 400, code = 'TOURNAMENT_ERROR') {
    super(message);
    this.name = 'TournamentError';
    this.status = status;
    this.code = code;
  }
}

module.exports = { TournamentError };

