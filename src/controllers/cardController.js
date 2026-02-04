const { Op, fn, col, literal, where, cast } = require('sequelize');
const Card = require('../models/Card');
const Listing = require('../models/Listing');
const User = require('../models/User');
const onePieceService = require('../services/onepieceService');
const { sequelize } = require('../database/connection');

const applyColorFilter = (query, colorValue) => {
  const safeColor = String(colorValue || '').replace(/\"/g, '').trim();
  if (!safeColor) return;

  query[Op.and] = [
    ...(query[Op.and] || []),
    {
      [Op.or]: [
        where(cast(col('colors'), 'text'), { [Op.iLike]: `%${safeColor}%` }),
        { color: { [Op.iLike]: `%${safeColor}%` } }
      ]
    }
  ];
};

const applyVariantFilter = (query, variantFilter) => {
  if (!variantFilter) return;
  if (variantFilter[Op.and]) {
    query[Op.and] = [...(query[Op.and] || []), ...variantFilter[Op.and]];
  } else {
    query[Op.and] = [...(query[Op.and] || []), variantFilter];
  }
};

const buildVariantFilter = (variantValue) => {
  if (variantValue == null || Number.isNaN(variantValue)) return null;
  const suffixMap = {
    1: '_p1',
    2: '_r1',
    3: '_p2'
  };
  const suffix = suffixMap[variantValue] || null;

  if (variantValue === 0) {
    return {
      [Op.and]: [
        { image_url: { [Op.notILike]: '%_p1.png%' } },
        { image_url: { [Op.notILike]: '%_r1.png%' } },
        { image_url: { [Op.notILike]: '%_r2.png%' } },
        { image_url: { [Op.notILike]: '%_p2.png%' } },
        {
          [Op.or]: [
            { variant: { [Op.notIn]: [1, 2, 3] } },
            { variant: null }
          ]
        }
      ]
    };
  }

  return {
    [Op.or]: [
      ...(suffix ? [{ image_url: { [Op.iLike]: `%${suffix}.png%` } }] : []),
      { variant: variantValue }
    ]
  };
};

// --- FUNÃ‡ÃƒO ÃšNICA PARA A PÃGINA DE BUSCA ---
const showCardsPage = async (req, res) => {
  try {
    const currentPage = parseInt(req.query.p) || 1;
    const limit = 50;
    
    const cardMatchQuery = { game: 'onepiece' };

    if (req.query.rarity && req.query.rarity !== '') cardMatchQuery.rarity = req.query.rarity;
    if (req.query.color && req.query.color !== '') applyColorFilter(cardMatchQuery, req.query.color);
    if (req.query.type && req.query.type !== '') cardMatchQuery.type_line = req.query.type;
    if (req.query.set && req.query.set !== '') {
      const setCode = req.query.set.replace(/-/g, '-?');
      cardMatchQuery.set_name = { [Op.iLike]: `%${setCode}%` };
    }
    if (req.query.q && req.query.q !== '') cardMatchQuery.name = { [Op.iLike]: `%${req.query.q}%` };
    if (req.query.variant && req.query.variant !== '') {
      const variantValue = parseInt(req.query.variant, 10);
      const variantFilter = buildVariantFilter(variantValue);
      applyVariantFilter(cardMatchQuery, variantFilter);
    }
    if (!req.query.variant || req.query.variant === '') {
      const baseFilter = buildVariantFilter(0);
      applyVariantFilter(cardMatchQuery, baseFilter);
    }

    const distinctCardIdsResult = await Listing.findAll({ 
        attributes: [[fn('DISTINCT', col('cardId')), 'cardId']],
        where: { quantity: { [Op.gt]: 0 } }
    });
    const distinctCardIds = distinctCardIdsResult.map(item => item.cardId);

    const rarities = await Card.findAll({ attributes: [[fn('DISTINCT', col('rarity')), 'rarity']], where: { game: 'onepiece' } }).then(r => r.map(i => i.rarity));
    const colors = await Card.findAll({ attributes: [[fn('DISTINCT', col('color')), 'color']], where: { game: 'onepiece' } }).then(r => r.map(i => i.color));
    const types = await Card.findAll({ attributes: [[fn('DISTINCT', col('type_line')), 'type_line']], where: { game: 'onepiece' } }).then(r => r.map(i => i.type_line));
    const rawSets = await Card.findAll({ attributes: [[fn('DISTINCT', col('set_name')), 'set_name']], where: { game: 'onepiece' } }).then(r => r.map(i => i.set_name));

    const setsByType = { op: [], st: [], prb: [], p: [], other: [] };
    rawSets.forEach(rawSet => {
      if (!rawSet) return;
      const opMatch = rawSet.match(/OP-?(\d+)/i);
      const stMatch = rawSet.match(/ST-?(\d+)/i);
      const prbMatch = rawSet.match(/PRB-?(\d+)/i);
      const pMatch = rawSet.match(/P-?(\d+)/i);
      if (opMatch) { setsByType.op.push('OP' + opMatch[1].padStart(2, '0')); }
      else if (stMatch) { setsByType.st.push('ST' + stMatch[1].padStart(2, '0')); }
      else if (prbMatch) { setsByType.prb.push('PRB-' + prbMatch[1].padStart(3, '0')); }
      else if (pMatch) { setsByType.p.push('P-' + pMatch[1].padStart(3, '0')); }
      else { setsByType.other.push(rawSet); }
    });
    const sortNumerically = (a, b) => (parseInt(a.match(/\d+/)?.[0] || 0) - parseInt(b.match(/\d+/)?.[0] || 0));
    setsByType.op.sort(sortNumerically);
    setsByType.st.sort(sortNumerically);
    setsByType.prb.sort(sortNumerically);
    setsByType.p.sort(sortNumerically);
    setsByType.other.sort();
    const sortedSets = [...new Set([...setsByType.op, ...setsByType.st, ...setsByType.prb, ...setsByType.p, ...setsByType.other])];

    const dons = Card.rawAttributes.don
      ? await Card.findAll({ attributes: [[fn('DISTINCT', col('don')), 'don']], where: { game: 'onepiece' } }).then(r => r.map(i => i.don))
      : [];
    const variantOptions = [
      { value: '', label: 'Todas' },
      { value: '0', label: 'Padrao' },
      { value: '1', label: 'Parallel/AA' },
      { value: '2', label: 'Alt Art' },
      { value: '3', label: 'Reprint/Variacao' }
    ];

    const filterGroups = [
      { name: 'Raridade', key: 'rarity', options: [{ value: '', label: 'Todas' }, ...rarities.sort().map(r => ({ value: r, label: r }))] },
      { name: 'Cor', key: 'color', options: [{ value: '', label: 'Todas' }, ...colors.sort().map(c => ({ value: c, label: c }))] },
      { name: 'Tipo', key: 'type', options: [{ value: '', label: 'Todos' }, ...types.sort().map(t => ({ value: t, label: t }))] },
      { name: 'EdiÃ§Ã£o', key: 'set', options: [{ value: '', label: 'Todas' }, ...sortedSets.map(s => ({ value: s, label: s }))] },
      { name: 'DON', key: 'don', options: [{ value: '', label: 'Todos' }, ...dons.filter(Boolean).map(d => ({ value: d, label: d }))] },
      { name: 'Variante', key: 'variant', options: variantOptions }
    ];

    if (distinctCardIds.length === 0) {
      return res.render('pages/cardSearchPage', {
        title: 'Explorar Cartas de One Piece',
        game: 'onepiece',
        filterGroups: filterGroups,
        cards: [],
        currentPage,
        hasMore: false,
        totalCards: 0,
        totalPages: 1,
        filters: req.query,
      });
    }

    const { count, rows: cards } = await Card.findAndCountAll({
        where: { id: { [Op.in]: distinctCardIds }, ...cardMatchQuery },
        include: [{
            model: Listing,
            as: 'listings',
            attributes: [],
            where: { quantity: { [Op.gt]: 0 } },
            required: true
        }],
        attributes: [
            'id',
            'name',
            'image_url',
            'set_name',
            'rarity',
            'type_line',
            'price_trend',
            'ability',
            'images',
            'variant',
            [fn('MIN', col('listings.price')), 'lowestAvailablePrice'],
            [fn('BOOL_OR', col('listings.is_foil')), 'hasFoil']
        ],
        group: ['Card.id'],
        order: [['name', 'ASC']],
        offset: (currentPage - 1) * limit,
        limit: limit,
        subQuery: false
    });

    const totalCards = count.length;

    res.render('pages/cardSearchPage', {
      title: 'Explorar Cartas de One Piece',
      game: 'onepiece',
      filterGroups: filterGroups,
      cards: cards,
      currentPage,
      hasMore: (currentPage * limit) < totalCards,
      totalCards,
      totalPages: Math.max(1, Math.ceil(totalCards / limit)),
      filters: req.query,
    });
  } catch (error) {
    console.error("Erro na pÃ¡gina de busca de One Piece:", error);
    res.render('pages/cardSearchPage', { title: 'Erro', game: 'onepiece', filterGroups: filterGroups, cards: [], filters: {}, currentPage: 1, hasMore: false, totalCards: 0 });
  }
};

// --- FUNÃ‡ÃƒO PARA A PÃGINA DE DETALHES DA CARTA ---
const showCardDetailPage = async (req, res) => {
  try {
    const cardId = req.params.id;
    if (!cardId || isNaN(cardId)) {
      return res.status(400).send('ID de carta invÃ¡lido');
    }

    const mainCard = await Card.findByPk(cardId);
    if (!mainCard) {
      return res.status(404).send('Carta nÃ£o encontrada');
    }

    let allVersions = [];
    if (mainCard.code) {
      allVersions = await Card.findAll({
        where: {
          code: mainCard.code,
          set_name: mainCard.set_name
        }
      });
    } else if (mainCard.api_id) {
      const baseApiId = mainCard.api_id.split('_')[0];
      allVersions = await Card.findAll({
        where: {
          api_id: { [Op.iLike]: `${baseApiId}%` },
          set_name: mainCard.set_name
        }
      });
    }
    allVersions.sort((a, b) => a.api_id.localeCompare(b.api_id));

    const listings = await Listing.findAll({ 
        where: { cardId: mainCard.id },
        order: [['price', 'ASC']],
        include: [{ model: User, as: 'seller', attributes: ['username', 'accountType', 'avatar'] }]
    });

    const prices = listings.map(l => l.price);
    mainCard.lowestPrice = prices.length ? Math.min(...prices) : null;
    mainCard.highestPrice = prices.length ? Math.max(...prices) : null;

    res.render('pages/card-detail', { card: mainCard, listings, allVersions });
  } catch (error) {
    console.error("Erro ao buscar detalhes da carta:", error);
    res.status(500).send('Erro no servidor');
  }
};

// --- FUNÃ‡ÃƒO PARA A API DE BUSCA DA PÃGINA DE VENDA ---
const searchCardsForSale = async (req, res) => {
  try {
    const searchQuery = req.query.q;
    let searchResults = [];
    if (searchQuery && searchQuery.length > 2) {
      const cards = await Card.findAll({
        where: {
          game: 'onepiece',
          [Op.or]: [
            { name: { [Op.iLike]: `%${searchQuery}%` } },
            { code: { [Op.iLike]: `%${searchQuery}%` } },
            { api_id: { [Op.iLike]: `%${searchQuery}%` } }
          ]
        },
        attributes: ['id', 'name', 'set_name', 'image_url', 'api_id', 'code']
      });
      searchResults = cards.map(card => {
        const data = card.toJSON();
        if (data._id == null) data._id = data.id;
        return data;
      });
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
      const distinctCardIdsResult = await Listing.findAll({ attributes: [[fn('DISTINCT', col('cardId')), 'cardId']] });
      const distinctCardIds = distinctCardIdsResult.map(r => r.cardId);
      searchResults = await Card.findAll({
        where: {
          id: { [Op.in]: distinctCardIds },
          game: 'onepiece',
          name: { [Op.iLike]: `%${searchQuery}%` }
        },
        attributes: ['name', 'set_name', 'image_url'],
        limit: 10
      });
    }
    res.json(searchResults);
  } catch (error) {
    console.error("Erro na API de busca de cartas disponÃ­veis:", error);
    res.status(500).json({ message: 'Erro no servidor' });
  }
};

const searchForDeckBuilder = async (req, res) => {
  try {
    const searchQuery = req.query.q;
    if (!searchQuery || searchQuery.length < 2) {
      return res.json([]);
    }

    const setPattern = /^OP-?(\d+)$/i;
    const setMatch = searchQuery.match(setPattern);
    
    let whereClause;
    if (setMatch) {
      const setNumber = setMatch[1].padStart(2, '0');
      whereClause = {
        game: 'onepiece',
        [Op.or]: [
          { api_id: { [Op.iLike]: `OP-${setNumber}%` } },
          { code: { [Op.iLike]: `OP-${setNumber}%` } }
        ]
      };
    } else {
      whereClause = {
        game: 'onepiece',
        [Op.or]: [
          { name: { [Op.iLike]: `%${searchQuery}%` } },
          { code: { [Op.iLike]: `%${searchQuery}%` } },
          { api_id: { [Op.iLike]: `%${searchQuery}%` } }
        ]
      };
    }

    const cards = await Card.findAll({
        where: whereClause,
        include: [{
            model: Listing,
            as: 'listings',
            attributes: [],
            where: { quantity: { [Op.gt]: 0 } },
            required: false
        }],
        attributes: [
            'id', 'name', 'set_name', 'image_url', 'images', 'api_id', 'code', 'rarity', 'type_line', 'colors', 'color', 'ability', 'cost', 'power',
            [literal('CASE WHEN COUNT("listings"."id") > 0 THEN \'available\' ELSE \'out_of_stock\' END'), 'status'],
            [fn('MIN', col('listings.price')), 'price']
        ],
        group: ['Card.id'],
        order: [['code', 'ASC'], ['name', 'ASC']]
    });

    res.json(cards);
  } catch (error) {
    console.error("Error in deck builder search:", error);
    res.status(500).json({ message: 'Erro no servidor' });
  }
};

const getLeaders = async (req, res) => {
  try {
    const { q, color, set } = req.query;
    const filter = {
      game: 'onepiece',
      type_line: 'LEADER'
    };
    if (q) filter.name = { [Op.iLike]: `%${q}%` };
    if (color) applyColorFilter(filter, color);
    if (set) filter.set_name = { [Op.iLike]: `%${set}%` };

    const leaders = await Card.findAll({
      where: filter,
      attributes: ['id', 'name', 'image_url', 'colors', 'set_name', 'rarity', 'power', 'ability'],
      order: [['name', 'ASC']]
    });
    res.json(leaders);
  } catch (error) {
    console.error("Erro ao buscar lÃ­deres:", error);
    res.status(500).json({ message: 'Erro ao buscar lÃ­deres.' });
  }
};

const getAllCards = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 52;

    const filterQuery = { 
      game: 'onepiece',
      name: { [Op.ne]: null, [Op.ne]: 'undefined' },
      [Op.and]: [
        literal('length(name) > 0'),
      ]
    };
    if (req.query.rarity) filterQuery.rarity = req.query.rarity;
    if (req.query.color) applyColorFilter(filterQuery, req.query.color);
    if (req.query.type) filterQuery.type_line = req.query.type;
    if (req.query.set) filterQuery.set_name = { [Op.iLike]: `%${req.query.set}%` };
    if (req.query.variant) {
      const variantValue = parseInt(req.query.variant, 10);
      const variantFilter = buildVariantFilter(variantValue);
      applyVariantFilter(filterQuery, variantFilter);
    }
    if (!req.query.variant || req.query.variant === '') {
      const baseFilter = buildVariantFilter(0);
      applyVariantFilter(filterQuery, baseFilter);
    }
    if (req.query.q) {
      filterQuery[Op.or] = [
        { name: { [Op.iLike]: `%${req.query.q}%` } },
        { code: { [Op.iLike]: `%${req.query.q}%` } }
      ];
    }

    const { count, rows: cards } = await Card.findAndCountAll({
      where: filterQuery,
      order: [['name', 'ASC']],
      offset: (page - 1) * limit,
      limit: limit
    });

    const cardsWithId = cards.map(card => {
      const data = card.toJSON ? card.toJSON() : card;
      if (data._id == null) data._id = data.id;
      return data;
    });

    res.json({
      cards: cardsWithId,
      hasMore: (page * limit) < count,
      currentPage: page,
    });
  } catch (error) {
    console.error("Erro ao buscar todas as cartas de One Piece do banco de dados:", error);
    res.status(500).json({ message: 'Erro no servidor' });
  }
};

const debugCardSearch = async (req, res) => {
  try {
    const cardApiId = req.params.name;
    const card = await Card.findOne({ where: { api_id: cardApiId, game: 'onepiece' } });
    if (card) {
      res.json({ success: true, message: 'Card found', card: card });
    } else {
      res.json({ success: false, message: 'Card not found' });
    }
  } catch (error) {
    console.error('DEBUG: Error during card search:', error);
    res.status(500).json({ success: false, message: 'Server error during debug search' });
  }
};

const getAvailableCards = async (req, res) => {
  try {
    const currentPage = parseInt(req.query.p) || 1;
    const limit = 50;
    
    const cardMatchQuery = { game: 'onepiece' };
    if (req.query.rarity) cardMatchQuery.rarity = req.query.rarity;
    if (req.query.color) applyColorFilter(cardMatchQuery, req.query.color);
    if (req.query.type) cardMatchQuery.type_line = req.query.type;
    if (req.query.set) cardMatchQuery.set_name = { [Op.iLike]: `%${req.query.set}%` };
    if (req.query.q) cardMatchQuery.name = { [Op.iLike]: `%${req.query.q}%` };
    if (req.query.variant) {
      const variantValue = parseInt(req.query.variant, 10);
      const variantFilter = buildVariantFilter(variantValue);
      applyVariantFilter(cardMatchQuery, variantFilter);
    }
    if (!req.query.variant || req.query.variant === '') {
      const baseFilter = buildVariantFilter(0);
      applyVariantFilter(cardMatchQuery, baseFilter);
    }
    
    const distinctCardIdsResult = await Listing.findAll({ 
        attributes: [[fn('DISTINCT', col('cardId')), 'cardId']],
        where: { quantity: { [Op.gt]: 0 } }
    });
    const distinctCardIds = distinctCardIdsResult.map(item => item.cardId);

    if (distinctCardIds.length === 0) {
      return res.json({
        cards: [],
        hasMore: false,
        currentPage: currentPage,
        totalCards: 0
      });
    }

    const { count, rows: cards } = await Card.findAndCountAll({
        where: { id: { [Op.in]: distinctCardIds }, ...cardMatchQuery },
        include: [{
            model: Listing,
            as: 'listings',
            attributes: [],
            where: { quantity: { [Op.gt]: 0 } },
            required: true
        }],
        attributes: [
            'id', 'name', 'image_url', 'set_name', 'rarity', 'type_line', 'price_trend', 'ability', 'images', 'variant',
            [fn('MIN', col('listings.price')), 'lowestAvailablePrice'],
            [fn('BOOL_OR', col('listings.is_foil')), 'hasFoil']
        ],
        group: ['Card.id'],
        order: [['name', 'ASC']],
        offset: (currentPage - 1) * limit,
        limit: limit,
        subQuery: false
    });

    const cardsWithId = cards.map(card => {
      const data = card.toJSON ? card.toJSON() : card;
      if (data._id == null) data._id = data.id;
      return data;
    });

    res.json({
      cards: cardsWithId,
      hasMore: (currentPage * limit) < count.length,
      currentPage: currentPage,
      totalCards: count.length
    });
  } catch (error) {
    console.error("âŒ Erro na API de cartas disponÃ­veis:", error);
    res.status(500).json({ message: 'Erro no servidor', cards: [], hasMore: false, currentPage: 1, totalCards: 0 });
  }
};

const getCardById = async (req, res) => {
  try {
    const cardId = req.params.id;
    if (!cardId || isNaN(cardId)) {
      return res.status(400).json({ error: 'ID de carta invÃ¡lido' });
    }
    const card = await Card.findByPk(cardId);
    if (!card) {
      return res.status(404).json({ error: 'Carta nÃ£o encontrada' });
    }
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
  getCardById,
};



