function isPlayerInMatch(match, registrationId) {
  if (!registrationId) return false;
  return [match.playerAId, match.playerBId].includes(registrationId);
}

function canConfirmReportedResult({ isOrganizer, userRegistrationId, match }) {
  if (isOrganizer) return true;
  if (!isPlayerInMatch(match, userRegistrationId)) return false;
  if (match.resultReportedByRegistrationId == null) return false;
  return userRegistrationId !== match.resultReportedByRegistrationId;
}

module.exports = {
  isPlayerInMatch,
  canConfirmReportedResult
};

