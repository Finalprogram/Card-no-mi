const express = require('express');
const tournamentController = require('../controllers/tournamentController');
const { isAuthPage, isAuthApi } = require('../middleware/auth');
const tournamentBannerUpload = require('../middleware/tournamentBannerUpload');

const router = express.Router();

// Pages / listing
router.get('/', tournamentController.listPage);
router.get('/create', isAuthPage, tournamentController.createPage);
router.get('/my/registrations', isAuthPage, tournamentController.getMyTournamentRegistrationsPageData);
router.get('/:id/manage', isAuthPage, tournamentController.getTournamentDashboardData);

// Tournaments REST
router.post('/', isAuthApi, tournamentBannerUpload.single('bannerFile'), tournamentController.create);
router.patch('/:id', isAuthApi, tournamentController.update);
router.post('/:id/publish', isAuthApi, tournamentController.publish);
router.post('/:id/registration/open', isAuthApi, tournamentController.openRegistration);
router.post('/:id/registration/close', isAuthApi, tournamentController.closeRegistration);
router.post('/:id/checkin/open', isAuthApi, tournamentController.openCheckIn);
router.post('/:id/checkin/close', isAuthApi, tournamentController.closeCheckIn);
router.post('/:id/start', isAuthApi, tournamentController.start);
router.post('/:id/finish', isAuthApi, tournamentController.finish);
router.post('/:id/tournament/cancel', isAuthApi, tournamentController.cancel);
router.get('/me/registrations', isAuthApi, tournamentController.myRegistrations);
router.get('/admin/audit', isAuthApi, tournamentController.getAuditLogs);

// Registrations
router.post('/:id/register', isAuthApi, tournamentController.register);
router.post('/:id/join', isAuthApi, tournamentController.register);
router.post('/:id/cancel', isAuthApi, tournamentController.cancelMyRegistration);
router.post('/:id/drop', isAuthApi, tournamentController.dropRegistration);
router.post('/:id/checkin', isAuthApi, tournamentController.checkIn);
router.get('/:id/registrations', isAuthApi, tournamentController.listRegistrations);
router.get('/:id/participants/:participantId/profile', tournamentController.getParticipantProfile);

// Payments
router.post('/:id/payments/charge', isAuthApi, tournamentController.createPaymentCharge);
router.post('/payments/webhook', tournamentController.webhook);
router.post('/:id/payments/refund', isAuthApi, tournamentController.refund);

// Decklists
router.post('/:id/decklist', isAuthApi, tournamentController.submitDecklist);
router.get('/:id/decklists', isAuthApi, tournamentController.getDecklists);
router.get('/:id/decklist/me', isAuthApi, tournamentController.getMyDecklist);

// Matches
router.get('/:id/matches', tournamentController.getMatches);
router.post('/:id/matches/:matchId/report', isAuthApi, tournamentController.reportMatch);
router.post('/matches/:matchId/report', isAuthApi, tournamentController.reportMatch);
router.post('/:id/matches/:matchId/confirm', isAuthApi, tournamentController.confirmMatch);
router.post('/matches/:matchId/confirm', isAuthApi, tournamentController.confirmMatch);
router.post('/:id/matches/:matchId/dispute', isAuthApi, tournamentController.disputeMatch);

// Standings / stages
router.get('/:id/standings', tournamentController.getStandings);
router.get('/:id/stages', tournamentController.getStages);

// Round generation / formats
router.post('/:id/rounds/generate', isAuthApi, tournamentController.generateRound);
router.post('/:id/rounds/swiss', isAuthApi, tournamentController.manualSwissRound);
router.post('/:id/start-round', isAuthApi, tournamentController.manualSwissRound);
router.post('/:id/topcut/generate', isAuthApi, tournamentController.generateTopCut);

// Legacy page form submit
router.post('/create', isAuthPage, tournamentBannerUpload.single('bannerFile'), tournamentController.create);
router.get('/:id', tournamentController.detailPage);

module.exports = router;
