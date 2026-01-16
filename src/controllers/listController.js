const { Op } = require('sequelize');
const Card = require('../models/Card');
const Listing = require('../models/Listing');
const User = require('../models/User');
const logger = require('../config/logger');

const addToList = (req, res) => {
  try {
    const { cardId, quantity } = req.body;

    if (!req.session.list) req.session.list = [];

    const existingItemIndex = req.session.list.findIndex(item => item.cardId === cardId);

    if (existingItemIndex > -1) {
      req.session.list[existingItemIndex].quantity += parseInt(quantity, 10);
    } else {
      req.session.list.push({ cardId, quantity: parseInt(quantity, 10) });
    }

    const totalItems = req.session.list.reduce((sum, item) => sum + item.quantity, 0);

    logger.info('Sessão da Lista atualizada:', req.session.list);
    res.status(200).json({ success: true, totalItems: totalItems });

  } catch (error) {
    logger.error('Erro ao adicionar à lista:', error);
    res.status(500).json({ success: false, message: 'Erro no servidor' });
  }
};

const showListPage = async (req, res) => {
  try {
    const userList = req.session.list || [];

    if (userList.length === 0) {
      return res.render('pages/list', { wantList: [] });
    }

    const cardIds = userList.map(item => item.cardId);
    const cards = await Card.findAll({ where: { id: { [Op.in]: cardIds } } });
    const listings = await Listing.findAll({ 
        where: { cardId: { [Op.in]: cardIds } },
        order: [['price', 'ASC']],
        include: [{ model: User, as: 'seller', attributes: ['username', 'accountType'] }]
    });

    const wantList = cards.map(card => {
      const listItem = userList.find(item => item.cardId.toString() === card.id.toString());
      const cardListings = listings.filter(listing => listing.cardId.toString() === card.id.toString());
      
      return {
        card: card,
        quantityWanted: listItem.quantity,
        listings: cardListings,
        lowestPrice: cardListings.length > 0 ? cardListings[0].price : null
      };
    });

    res.render('pages/list', { wantList });
  } catch (error) {
    logger.error('Erro ao montar a página da lista:', error);
    res.status(500).send('Erro no servidor');
  }
};

const filterSellers = async (req, res) => {
  try {
    const { cardId, filters } = req.body;

    const matchQuery = { cardId: cardId };

    if (filters.condition) matchQuery.condition = filters.condition;
    if (filters.language) matchQuery.language = filters.language;
    if (filters.is_foil !== undefined) matchQuery.is_foil = filters.is_foil;

    const listings = await Listing.findAll({
        where: matchQuery,
        order: [['price', 'ASC']],
        include: [{ model: User, as: 'seller', attributes: ['username'] }]
    });

    res.json(listings);

  } catch (error) {
    logger.error('Erro ao filtrar vendedores:', error);
    res.status(500).json({ message: 'Erro no servidor' });
  }
};

const removeFromList = (req, res) => {
  try {
    const { cardId } = req.body;
    if (!req.session.list) {
      req.session.list = [];
    }
    req.session.list = req.session.list.filter(item => item.cardId !== cardId);
    
    const totalItems = req.session.list.reduce((sum, item) => sum + item.quantity, 0);

    res.status(200).json({ success: true, message: 'Item removido!', list: req.session.list, totalItems });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor' });
  }
};

module.exports = {
  addToList,
  showListPage,
  filterSellers,
  removeFromList,
};