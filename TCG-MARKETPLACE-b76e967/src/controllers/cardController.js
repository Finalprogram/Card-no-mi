const mongoose = require('mongoose');
const Card = require('../models/Card');
const Listing = require('../models/Listing');
const onePieceService = require('../services/onepieceService');

// --- FUNÇÃO ÚNICA PARA A PÁGINA DE BUSCA ---
const showCardsPage = async (req, res) => {
  try {
    const currentPage = parseInt(req.query.p) || 1;
    const limit = 50;
    
    // Define a busca base para 'onepiece'
    const cardMatchQuery = { game: 'onepiece' };

    // Adiciona os filtros de One Piece se eles existirem na URL
    if (req.query.rarity) cardMatchQuery.rarity = req.query.rarity;
    if (req.query.color) cardMatchQuery.colors = new RegExp(req.query.color, 'i');
    if (req.query.type) cardMatchQuery.type_line = req.query.type;
    if (req.query.set) {
      const setCode = req.query.set.replace(/OP-?/, '');
      cardMatchQuery.set_name = new RegExp(`OP-?${setCode}`, 'i');
    }
    if (req.query.q) cardMatchQuery.name = new RegExp(req.query.q, 'i');

    // Busca no banco de dados
    const distinctCardIds = await Listing.distinct('card');
    const totalCards = await Card.countDocuments({ _id: { $in: distinctCardIds }, ...cardMatchQuery });

    const cards = await Card.aggregate([
      { $match: { _id: { $in: distinctCardIds }, ...cardMatchQuery }},
      { $lookup: { from: 'listings', localField: '_id', foreignField: 'card', as: 'listings' }},
      { $addFields: { lowestPrice: { $min: '$listings.price' }}},
      { $sort: { name: 1 }},
      { $skip: (currentPage - 1) * limit },
      { $limit: limit }
    ]);
    const formattedCards = cards.map(card => ({ ...card, averagePrice: card.lowestPrice }));

    // Busca as opções de filtro dinamicamente do banco de dados
    const rarities = await Card.distinct('rarity');
    const colors = await Card.distinct('colors');
    const types = await Card.distinct('type_line');

    const rawSets = await Card.distinct('set_name', {
      game: 'onepiece',
      set_name: /OP-?\d+/
    });

    const opSetPattern = /(OP-?\d+)/;
    const normalizedSet = new Set();
    rawSets.forEach(rawSet => {
      const match = rawSet.match(opSetPattern);
      if (match) {
        const setCode = 'OP' + match[1].replace(/OP-?/, '').padStart(2, '0');
        normalizedSet.add(setCode);
      }
    });

    const sortedSets = Array.from(normalizedSet).sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0]);
      const numB = parseInt(b.match(/\d+/)[0]);
      return numA - numB;
    });

    // Define os filtros que serão enviados para a view
    const filterGroups = [
      { name: 'Raridade', key: 'rarity', options: rarities.sort() },
      { name: 'Cor', key: 'color', options: colors.sort() },
      { name: 'Tipo', key: 'type', options: types.sort() },
      { name: 'Edição', key: 'set', options: sortedSets }
    ];

    res.render('pages/cardSearchPage', {
      title: 'Explorar Cartas de One Piece',
      game: 'onepiece',
      filterGroups: filterGroups,
      cards: formattedCards,
      currentPage,
      hasMore: (currentPage * limit) < totalCards,
      totalCards,
      filters: req.query,
    });
  } catch (error) {
    console.error("Erro na página de busca de One Piece:", error);
    res.render('pages/cardSearchPage', { 
        title: 'Erro', 
        game: 'onepiece', 
        filterGroups: [],
        cards: [], 
        filters: {}, 
        currentPage: 1, 
        hasMore: false, 
        totalCards: 0 
    });
  }
};

// --- FUNÇÃO PARA A PÁGINA DE DETALHES DA CARTA ---
const showCardDetailPage = async (req, res) => {
  try {
    const cardId = req.params.id;
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).send('Carta não encontrada');
    }

    const listings = await Listing.find({ card: cardId })
                                  .sort({ price: 1 })
                                  .populate('seller', 'username accountType');

    // Calcula o preço médio
    let averagePrice = 0;
    if (listings.length > 0) {
      const total = listings.reduce((acc, listing) => acc + listing.price, 0);
      averagePrice = total / listings.length;
    }

    // Adiciona o preço médio e a tendência ao objeto card
    const cardData = {
      ...card.toObject(),
      averagePrice: averagePrice,
      price_trend: 'neutral' // Lógica de tendência pode ser adicionada aqui
    };

    res.render('pages/card-detail', { card: cardData, listings });
  } catch (error) {
    console.error("Erro ao buscar detalhes da carta:", error);
    res.status(500).send('Erro no servidor');
  }
};

// --- FUNÇÃO PARA A API DE BUSCA DA PÁGINA DE VENDA ---
const searchCardsForSale = async (req, res) => {
  try {
    const searchQuery = req.query.q;
    let searchResults = [];

    if (searchQuery && searchQuery.length > 2) {
      // CORREÇÃO: Removemos a lógica de 'distinctCardIds' para buscar em TODAS as cartas.
      searchResults = await Card.find({
        game: 'onepiece', // Garante que a busca seja apenas de One Piece
        name: { $regex: new RegExp(searchQuery, 'i') }
      }).select('name set_name image_url').limit(10);
    }
    res.json(searchResults);
    
  } catch (error) {
    console.error("Erro na API de busca de cartas:", error);
    res.status(500).json({ message: 'Erro no servidor' });
  }
};
const searchAvailableCards = async (req, res) => {
  try {
    const searchQuery = req.query.q;
    let searchResults = [];

    if (searchQuery && searchQuery.length > 2) {
      // 1. Descobre quais cartas estão à venda
      const distinctCardIds = await Listing.distinct('card');
      
      // 2. Busca apenas DENTRO dessas cartas
      searchResults = await Card.find({
        _id: { $in: distinctCardIds },
        game: 'onepiece', // (ou o jogo relevante)
        name: { $regex: new RegExp(searchQuery, 'i') }
      }).select('name set_name image_url').limit(10);
    }
    res.json(searchResults);
    
  } catch (error) {
    console.error("Erro na API de busca de cartas disponíveis:", error);
    res.status(500).json({ message: 'Erro no servidor' });
  }
};
// --- EXPORTAÇÃO CORRIGIDA ---

// --- FUNÇÃO PARA A ENCICLOPÉDIA ---
const getAllCards = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 52; // 4 linhas de 13 cartas

    // Constrói a query de filtro
    const filterQuery = { game: 'onepiece' };
    if (req.query.rarity) filterQuery.rarity = req.query.rarity;
    if (req.query.color) filterQuery.colors = new RegExp(req.query.color, 'i');
    if (req.query.type) filterQuery.type_line = req.query.type;
    if (req.query.set) {
      const setCode = req.query.set.replace(/OP-?/, '');
      filterQuery.set_name = new RegExp(`OP-?${setCode}`, 'i');
    }
    if (req.query.q) filterQuery.name = new RegExp(req.query.q, 'i');

    const cards = await Card.find(filterQuery)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const totalCards = await Card.countDocuments(filterQuery);

    res.json({
      cards,
      hasMore: (page * limit) < totalCards,
      currentPage: page,
    });

  } catch (error) {
    console.error("Erro ao buscar todas as cartas de One Piece do banco de dados:", error);
    res.status(500).json({ message: 'Erro no servidor' });
  }
};

module.exports = {
  showCardsPage,
  showCardDetailPage,
  searchCardsForSale,
  searchAvailableCards,
  getAllCards,
};