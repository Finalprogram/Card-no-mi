const logger = require('../config/logger');
const StoreCredit = require('../models/StoreCredit');
const Tournament = require('../models/Tournament');
const User = require('../models/User');

function isStoreAccount(user) {
  return user && ['store', 'partner_store'].includes(user.accountType);
}

exports.listStoreCreditsPage = async (req, res) => {
  const currentUser = req.session?.user;
  if (!currentUser) return res.redirect('/auth/login');
  if (!isStoreAccount(currentUser)) {
    req.flash('error_msg', 'Apenas lojas podem acessar esta página.');
    return res.redirect('/');
  }

  const credits = await StoreCredit.findAll({
    where: { storeId: currentUser.id },
    include: [
      { model: User, as: 'player', attributes: ['id', 'username', 'avatar'] },
      { model: Tournament, as: 'tournament', attributes: ['id', 'title'] }
    ],
    order: [['createdAt', 'DESC']]
  });

  return res.render('pages/store/credits', {
    title: 'Créditos da loja',
    credits
  });
};

exports.redeemCredit = async (req, res) => {
  try {
    const currentUser = req.session?.user;
    if (!currentUser) return res.status(401).json({ message: 'Não autenticado.' });
    if (!isStoreAccount(currentUser)) {
      return res.status(403).json({ message: 'Sem permissão.' });
    }

    const creditId = Number(req.params.id);
    const credit = await StoreCredit.findOne({ where: { id: creditId, storeId: currentUser.id } });
    if (!credit) return res.status(404).json({ message: 'Crédito não encontrado.' });
    if (credit.status !== 'AVAILABLE') {
      return res.status(409).json({ message: 'Crédito já foi utilizado ou cancelado.' });
    }

    credit.status = 'REDEEMED';
    credit.redeemedAt = new Date();
    await credit.save();

    logger.info(`[store-credits] Crédito ${credit.id} resgatado pela loja ${currentUser.id}.`);
    return res.json({ message: 'Crédito marcado como utilizado.', credit });
  } catch (error) {
    logger.error('[store-credits] Erro ao resgatar crédito', error);
    return res.status(500).json({ message: 'Erro interno ao resgatar crédito.' });
  }
};
