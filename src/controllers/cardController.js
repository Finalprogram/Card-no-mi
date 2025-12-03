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

    // Adiciona os filtros de One Piece se eles existirem na URL e não forem vazios
    if (req.query.rarity && req.query.rarity !== '') cardMatchQuery.rarity = req.query.rarity;
    if (req.query.color && req.query.color !== '') cardMatchQuery.colors = new RegExp(req.query.color, 'i');
    if (req.query.type && req.query.type !== '') cardMatchQuery.type_line = req.query.type;
    if (req.query.set && req.query.set !== '') {
      // Aceita qualquer tipo de edição (OP, ST, PRB, P, etc)
      const setCode = req.query.set.replace(/-/g, '-?');
      cardMatchQuery.set_name = new RegExp(setCode, 'i');
    }
    if (req.query.q && req.query.q !== '') cardMatchQuery.name = new RegExp(req.query.q, 'i');

    // Busca no banco de dados - apenas cartas COM anúncios ativos
    const distinctCardIds = await Listing.distinct('card', { quantity: { $gt: 0 } });
    const totalCards = await Card.countDocuments({ _id: { $in: distinctCardIds }, ...cardMatchQuery });

    const cards = await Card.aggregate([
      { $match: { _id: { $in: distinctCardIds }, game: 'onepiece', ...cardMatchQuery }},
      { $lookup: {
          from: 'listings',
          localField: '_id',
          foreignField: 'card',
          pipeline: [
            { $match: { quantity: { $gt: 0 } } }
          ],
          as: 'listings'
      }},
      { $addFields: {
          lowestAvailablePrice: { $min: '$listings.price' },
          hasFoil: { $anyElementTrue: [ '$listings.is_foil' ] }
      }},
      { $project: {
          _id: 1,
          name: 1,
          image_url: 1,
          set_name: 1,
          rarity: 1,
          type_line: 1,
          averagePrice: 1,
          price_trend: 1,
          lowestAvailablePrice: 1,
          ability: 1,
          hasFoil: 1
      }},
      { $sort: { name: 1 }},
      { $skip: (currentPage - 1) * limit },
      { $limit: limit }
    ]);
    const formattedCards = cards; // No need for further mapping, use as is

    // Busca as opções de filtro dinamicamente do banco de dados (todas as cartas, não só as com listings)
    const rarities = await Card.distinct('rarity', { game: 'onepiece' });
    const colors = await Card.distinct('colors', { game: 'onepiece' });
    const types = await Card.distinct('type_line', { game: 'onepiece' });

    // Busca TODAS as edições do jogo (OP, ST, PRB, P, etc)
    const rawSets = await Card.distinct('set_name', { game: 'onepiece' });

    // Normaliza e organiza as edições
    const setsByType = {
      op: [],      // Edições principais (OP01, OP02, etc)
      st: [],      // Starter Decks (ST01, ST02, etc)
      prb: [],     // Prize Cards
      p: [],       // Promotional
      other: []    // Outras edições
    };

    rawSets.forEach(rawSet => {
      if (!rawSet) return;
      
      // Tenta identificar o tipo de edição
      const opMatch = rawSet.match(/OP-?(\d+)/i);
      const stMatch = rawSet.match(/ST-?(\d+)/i);
      const prbMatch = rawSet.match(/PRB-?(\d+)/i);
      const pMatch = rawSet.match(/P-?(\d+)/i);
      
      if (opMatch) {
        const setCode = 'OP' + opMatch[1].padStart(2, '0');
        if (!setsByType.op.includes(setCode)) setsByType.op.push(setCode);
      } else if (stMatch) {
        const setCode = 'ST' + stMatch[1].padStart(2, '0');
        if (!setsByType.st.includes(setCode)) setsByType.st.push(setCode);
      } else if (prbMatch) {
        const setCode = 'PRB-' + prbMatch[1].padStart(3, '0');
        if (!setsByType.prb.includes(setCode)) setsByType.prb.push(setCode);
      } else if (pMatch) {
        const setCode = 'P-' + pMatch[1].padStart(3, '0');
        if (!setsByType.p.includes(setCode)) setsByType.p.push(setCode);
      } else {
        // Outras edições que não se encaixam nos padrões acima
        if (!setsByType.other.includes(rawSet)) setsByType.other.push(rawSet);
      }
    });

    // Ordena cada tipo numericamente
    const sortNumerically = (a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || 0);
      const numB = parseInt(b.match(/\d+/)?.[0] || 0);
      return numA - numB;
    };

    setsByType.op.sort(sortNumerically);
    setsByType.st.sort(sortNumerically);
    setsByType.prb.sort(sortNumerically);
    setsByType.p.sort(sortNumerically);
    setsByType.other.sort();

    // Combina todas as edições: OP primeiro, depois ST, PRB, P e outras
    const sortedSets = [
      ...setsByType.op,
      ...setsByType.st,
      ...setsByType.prb,
      ...setsByType.p,
      ...setsByType.other
    ];

    // Define os filtros que serão enviados para a view (com opção "Todas")
    const dons = await Card.distinct('don', { game: 'onepiece' });
    const filterGroups = [
      { name: 'Raridade', key: 'rarity', options: [{ value: '', label: 'Todas' }, ...rarities.sort().map(r => ({ value: r, label: r }))] },
      { name: 'Cor', key: 'color', options: [{ value: '', label: 'Todas' }, ...colors.sort().map(c => ({ value: c, label: c }))] },
      { name: 'Tipo', key: 'type', options: [{ value: '', label: 'Todos' }, ...types.sort().map(t => ({ value: t, label: t }))] },
      { name: 'Edição', key: 'set', options: [{ value: '', label: 'Todas' }, ...sortedSets.map(s => ({ value: s, label: s }))] },
      { name: 'DON', key: 'don', options: [{ value: '', label: 'Todos' }, ...dons.filter(Boolean).map(d => ({ value: d, label: d }))] }
    ];

    res.render('pages/cardSearchPage', {
      title: 'Explorar Cartas de One Piece',
      game: 'onepiece',
      filterGroups: filterGroups,
      cards: formattedCards,
      currentPage,
      hasMore: (currentPage * limit) < totalCards,
      totalCards,
      totalPages: Math.max(1, Math.ceil(totalCards / limit)),
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
    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).send('ID de carta inválido');
    }

    // Busca a carta principal
    const mainCard = await Card.findById(cardId).lean();
    if (!mainCard) {
      return res.status(404).send('Carta não encontrada');
    }


    // Busca todas as versões (pelo base do api_id), incluindo a principal
    let allVersions = [];
    if (mainCard.api_id) {
      const baseApiId = mainCard.api_id.split('_')[0];
      allVersions = await Card.find({
        api_id: { $regex: `^${baseApiId}` },
        set_name: mainCard.set_name
      }).lean();
    }
 11   // Ordena por api_id para manter ordem: normal, _p1, _p2, _p3
    allVersions = allVersions.sort((a, b) => {
      if (a.api_id === mainCard.api_id) return -1;
      if (b.api_id === mainCard.api_id) return 1;
      return a.api_id.localeCompare(b.api_id);
    });

    // Busca os anúncios (listings) para essa carta
    const listings = await Listing.find({ card: mainCard._id })
      .sort({ price: 1 })
      .populate({
        path: 'seller',
        select: 'username accountType avatar'
      })
      .lean();

    // Calcula menor/maior preço
    const prices = listings.map(l => l.price);
    mainCard.lowestPrice = prices.length ? Math.min(...prices) : null;
    mainCard.highestPrice = prices.length ? Math.max(...prices) : null;

    res.render('pages/card-detail', {
      card: mainCard,
      listings,
      allVersions
    });

  } catch (error) {
    console.error("Erro ao buscar detalhes da carta:", error);
    res.status(500).send('Erro no servidor');
  }
};

// --- FUNÇÃO PARA A API DE BUSCA DA PÁGINA DE VENDA ---
const searchCardsForSale = async (req, res) => {
  try {
    const searchQuery = req.query.q;
    console.log('DEBUG searchCardsForSale: searchQuery:', searchQuery);
    let searchResults = [];

    if (searchQuery && searchQuery.length > 2) {
      searchResults = await Card.find({
        game: 'onepiece',
        $or: [
          { name: { $regex: searchQuery, $options: 'i' } },
          { code: { $regex: searchQuery, $options: 'i' } },
          { api_id: { $regex: searchQuery, $options: 'i' } }
        ]
      })
      .select('name set_name image_url api_id code') // Also select 'code'
      .limit(10);
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
      
      // 2. Busca apenas DENTRO dessas cartas usando o índice de texto
      searchResults = await Card.find({
        _id: { $in: distinctCardIds },
        game: 'onepiece',
        $text: { $search: searchQuery }
      })
      .select('name set_name image_url')
      .limit(10);
    }
    res.json(searchResults);
    
  } catch (error) {
    console.error("Erro na API de busca de cartas disponíveis:", error);
    res.status(500).json({ message: 'Erro no servidor' });
  }
};

const searchForDeckBuilder = async (req, res) => {
  try {
    const searchQuery = req.query.q;
    if (!searchQuery || searchQuery.length < 2) {
      return res.json([]);
    }

    // Verifica se a busca é por código de edição (ex: OP13, OP-13, op13)
    const setPattern = /^OP-?(\d+)$/i;
    const setMatch = searchQuery.match(setPattern);
    
    let matchQuery;
    if (setMatch) {
      // Busca por edição: todas as cartas que começam com OP13 (ex: OP13-001, OP13-002, etc)
      const setNumber = setMatch[1].padStart(2, '0'); // Garante 2 dígitos (ex: 01, 13)
      matchQuery = {
        game: 'onepiece',
        $or: [
          { api_id: { $regex: `^OP-?${setNumber}`, $options: 'i' } },
          { code: { $regex: `^OP-?${setNumber}`, $options: 'i' } }
        ]
      };
    } else {
      // Busca normal por nome ou código
      matchQuery = {
        game: 'onepiece',
        $or: [
          { name: { $regex: searchQuery, $options: 'i' } },
          { code: { $regex: searchQuery, $options: 'i' } },
          { api_id: { $regex: searchQuery, $options: 'i' } }
        ]
      };
    }

    const cards = await Card.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'listings',
          localField: '_id',
          foreignField: 'card',
          pipeline: [
            { $match: { quantity: { $gt: 0 } } }
          ],
          as: 'availableListings'
        }
      },
      {
        $addFields: {
          status: {
            $cond: { if: { $gt: [{ $size: '$availableListings' }, 0] }, then: 'available', else: 'out_of_stock' }
          },
          price: { $min: '$availableListings.price' }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          set_name: 1,
          image_url: 1,
          images: 1,
          api_id: 1,
          code: 1,
          status: 1,
          rarity: 1,
          type_line: 1,
          colors: 1,
          color: 1,
          ability: 1,
          cost: 1,
          power: 1,
          opcg_id: '$card_id',
          price: 1
        }
      },
      { $sort: { code: 1, name: 1 } } // Ordena por código primeiro
    ]);

    res.json(cards);

  } catch (error) {
    console.error("Error in deck builder search:", error);
    res.status(500).json({ message: 'Erro no servidor' });
  }
};

// --- EXPORTAÇÃO CORRIGIDA ---

const getLeaders = async (req, res) => {
  try {
    const { q, color, set } = req.query;
    const filter = {
      game: 'onepiece',
      type_line: 'LEADER'
    };

    if (q) {
      filter.name = { $regex: q, $options: 'i' };
    }
    if (color) {
      filter.colors = { $regex: color, $options: 'i' };
    }
    if (set) {
      filter.set_name = { $regex: set, $options: 'i' };
    }

    const leaders = await Card.find(filter).select('_id name image_url colors set_name rarity power ability').sort({ name: 1 });
    res.json(leaders);
  } catch (error) {
    console.error("Erro ao buscar líderes:", error);
    res.status(500).json({ message: 'Erro ao buscar líderes.' });
  }
};

// --- FUNÇÃO PARA A ENCICLOPÉDIA ---
const getAllCards = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 52; // 4 linhas de 13 cartas

    // Constrói a query de filtro, excluindo cartas com nome inválido
    const filterQuery = { 
      game: 'onepiece',
      name: { $exists: true, $ne: null, $ne: '', $ne: 'undefined' }
    };
    if (req.query.rarity) filterQuery.rarity = req.query.rarity;
    if (req.query.color) filterQuery.colors = new RegExp(req.query.color, 'i');
    if (req.query.type) filterQuery.type_line = req.query.type;
    if (req.query.set) filterQuery.set_name = req.query.set;
    
    if (req.query.q) {
      const searchQuery = new RegExp(req.query.q, 'i');
      filterQuery.$or = [
        { name: searchQuery },
        { code: searchQuery }
      ];
    }

    let cards;
    let totalCards;
    let hasMore = false;

    if (req.query.q) {
      // Se houver uma busca específica (q), retorna todos os resultados sem paginação
      cards = await Card.find(filterQuery).sort({ name: 1 });
      totalCards = cards.length;
    } else {
      // Se não houver busca, aplica a paginação
      cards = await Card.find(filterQuery)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit);
      totalCards = await Card.countDocuments(filterQuery);
      hasMore = (page * limit) < totalCards;
    }

    res.json({
      cards,
      hasMore,
      currentPage: req.query.q ? 1 : page,
    });

  } catch (error) {
    console.error("Erro ao buscar todas as cartas de One Piece do banco de dados:", error);
    res.status(500).json({ message: 'Erro no servidor' });
  }
};

const debugCardSearch = async (req, res) => {
  try {
    const cardApiId = req.params.name; // Renomeado para refletir a busca por api_id
    const card = await Card.findOne({ api_id: cardApiId, game: 'onepiece' }); // Busca por api_id

    if (card) {
      console.log('DEBUG: Card found in DB:', card);
      res.json({ success: true, message: 'Card found', card: card });
    } else {
      console.log('DEBUG: Card not found in DB for api_id:', cardApiId); // Log de api_id
      res.json({ success: false, message: 'Card not found' });
    }
  } catch (error) {
    console.error('DEBUG: Error during card search:', error);
    res.status(500).json({ success: false, message: 'Server error during debug search' });
  }
};

// Nova função para a API de cartas disponíveis (com filtros)
const getAvailableCards = async (req, res) => {
  try {
    console.log('📦 getAvailableCards chamado com query:', req.query);
    const currentPage = parseInt(req.query.p) || 1;
    const limit = 50;
    
    // Define a busca base para 'onepiece'
    const cardMatchQuery = { game: 'onepiece' };

    // Adiciona os filtros de One Piece se eles existirem na URL e não forem vazios
    if (req.query.rarity && req.query.rarity !== '') cardMatchQuery.rarity = req.query.rarity;
    if (req.query.color && req.query.color !== '') cardMatchQuery.colors = new RegExp(req.query.color, 'i');
    if (req.query.type && req.query.type !== '') cardMatchQuery.type_line = req.query.type;
    if (req.query.set && req.query.set !== '') {
      // Aceita qualquer tipo de edição (OP, ST, PRB, P, etc)
      const setCode = req.query.set.replace(/-/g, '-?');
      cardMatchQuery.set_name = new RegExp(setCode, 'i');
    }
    if (req.query.q && req.query.q !== '') cardMatchQuery.name = new RegExp(req.query.q, 'i');
    
    console.log('🔍 Query construída:', cardMatchQuery);

    // Busca no banco de dados - apenas cartas COM anúncios ativos
    const distinctCardIds = await Listing.distinct('card', { quantity: { $gt: 0 } });
    const totalCards = await Card.countDocuments({ _id: { $in: distinctCardIds }, ...cardMatchQuery });

    const cards = await Card.aggregate([
      { $match: { _id: { $in: distinctCardIds }, game: 'onepiece', ...cardMatchQuery }},
      { $lookup: {
          from: 'listings',
          localField: '_id',
          foreignField: 'card',
          pipeline: [
            { $match: { quantity: { $gt: 0 } } }
          ],
          as: 'listings'
      }},
      { $addFields: {
          lowestAvailablePrice: { $min: '$listings.price' },
          hasFoil: { $anyElementTrue: [ '$listings.is_foil' ] }
      }},
      { $project: {
          _id: 1,
          name: 1,
          image_url: 1,
          set_name: 1,
          rarity: 1,
          type_line: 1,
          averagePrice: 1,
          price_trend: 1,
          lowestAvailablePrice: 1,
          ability: 1,
          hasFoil: 1
      }},
      { $sort: { name: 1 }},
      { $skip: (currentPage - 1) * limit },
      { $limit: limit }
    ]);

    console.log(`✅ Retornando ${cards.length} cartas (página ${currentPage} de ${Math.ceil(totalCards/limit)})`);
    
    res.json({
      cards: cards,
      hasMore: (currentPage * limit) < totalCards,
      currentPage: currentPage,
      totalCards: totalCards
    });

  } catch (error) {
    console.error("❌ Erro na API de cartas disponíveis:", error);
    res.status(500).json({ message: 'Erro no servidor', cards: [], hasMore: false, currentPage: 1, totalCards: 0 });
  }
};

/**
 * Obtém detalhes de uma carta específica por ID (para API)
 * @route GET /api/cards/:id
 */
const getCardById = async (req, res) => {
  try {
    const cardId = req.params.id;

    // Validação do ID
    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({ error: 'ID de carta inválido' });
    }

    const card = await Card.findById(cardId).lean();

    if (!card) {
      return res.status(404).json({ error: 'Carta não encontrada' });
    }

    // Retornar dados da carta em JSON
    res.json(card);
  } catch (error) {
    console.error("Erro ao buscar carta por ID:", error);
    res.status(500).json({ error: 'Erro ao buscar carta' });
  }
};

module.exports = {
  showCardsPage,
  showCardDetailPage,
  searchCardsForSale,
  searchAvailableCards,
  getAllCards,
  searchForDeckBuilder,
  debugCardSearch,
  getLeaders,
  getAvailableCards,
  getCardById, // Nova função
};