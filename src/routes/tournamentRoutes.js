const express = require('express');
const {
  listPage,
  createPage,
  create,
  detailPage,
  join,
  startNextRound,
  reportMatch
} = require('../controllers/tournamentController');
const { isAuthPage, isAuthApi } = require('../middleware/auth');
const tournamentBannerUpload = require('../middleware/tournamentBannerUpload');

const router = express.Router();

router.get('/', listPage);
router.get('/create', isAuthPage, createPage);
router.post('/create', isAuthPage, tournamentBannerUpload.single('bannerFile'), create);
router.get('/:id', detailPage);

router.post('/:id/join', isAuthApi, join);
router.post('/:id/start-round', isAuthApi, startNextRound);
router.post('/matches/:matchId/report', isAuthApi, reportMatch);

module.exports = router;
