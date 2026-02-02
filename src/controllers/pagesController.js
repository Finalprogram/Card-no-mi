// src/controllers/pagesController.js
const User = require('../models/User');
const Listing = require('../models/Listing');
const Card = require('../models/Card');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Deck = require('../models/Deck');
const Setting = require('../models/Setting');
const { Op, fn, col } = require('sequelize');
const { sequelize } = require('../database/connection');

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


function addIdAlias(value) {
  if (value && value.id != null && value._id == null) {
    value._id = value.id;
  }
  return value;
}

function toPlainWithId(modelInstance) {
  if (!modelInstance) return null;
  const data = modelInstance.toJSON ? modelInstance.toJSON() : modelInstance;
  return addIdAlias(data);
}

async function hydrateOrdersWithCards(orders) {
  const ordersData = orders.map(toPlainWithId);
  const cardIds = new Set();
  ordersData.forEach(order => {
    (order.items || []).forEach(item => {
      if (item.card) cardIds.add(Number(item.card));
    });
  });

  if (cardIds.size === 0) return ordersData;

  const cards = await Card.findAll({ where: { id: Array.from(cardIds) } });
  const cardMap = new Map(cards.map(card => [card.id, addIdAlias(card.toJSON())]));

  ordersData.forEach(order => {
    order.items = (order.items || []).map((item, index) => {
      const itemId = item.id || item._id || item.listing || item.card || `${order.id}-${index}`;
      return {
        ...item,
        id: itemId,
        _id: itemId,
        card: cardMap.get(Number(item.card)) || null
      };
    });
  });

  return ordersData;
}

async function hydrateDeckWithCards(deck) {
  if (!deck) return null;
  const deckData = toPlainWithId(deck);
  deckData.owner = addIdAlias(deckData.owner || null);

  const cardIds = new Set();
  if (deckData.leader && deckData.leader.card) cardIds.add(Number(deckData.leader.card));
  (deckData.main || []).forEach(item => {
    if (item.card) cardIds.add(Number(item.card));
  });

  if (cardIds.size === 0) return deckData;

  const cards = await Card.findAll({ where: { id: Array.from(cardIds) } });
  const cardMap = new Map(cards.map(card => [card.id, addIdAlias(card.toJSON())]));

  if (deckData.leader && deckData.leader.card) {
    deckData.leader.card = cardMap.get(Number(deckData.leader.card)) || null;
  }
  deckData.main = (deckData.main || []).map(item => ({
    ...item,
    card: cardMap.get(Number(item.card)) || null
  }));

  return deckData;
}

async function distinctValues(field, where) {
  const rows = await Card.findAll({
    attributes: [[fn('DISTINCT', col(field)), field]],
    where,
    raw: true
  });
  return rows.map(row => row[field]).filter(value => value != null && value !== '');
}
const showHomePage = async (req, res) => {
  try {
    const recentListings = await Listing.findAll({
      order: [['createdAt', 'DESC']],
      limit: 10,
      include: [{ model: Card, as: 'card' }]
    });

    res.render('pages/index', {
      title: 'Bem-vindo ao CardHub',
      recentListings: recentListings.map(listing => {
        const data = toPlainWithId(listing);
        if (data.card) data.card = addIdAlias(data.card);
        return data;
      }),
    });
  } catch (error) {
    console.error('Error fetching recent listings:', error);
    res.status(500).send('Server Error');
  }
};
const showProfilePage = async (req, res) => {
    // ...existing code...
    let userId = req.params.id;

    // If no ID is provided in the URL, try to get it from the session (logged-in user)
    if (!userId) {
      if (!req.session.user) {
        return res.redirect('/login'); // Redirect to login if not logged in
      }
      userId = req.session.user.id;
    }

    const isNumericId = String(userId).match(/^\d+$/);
    const profileUser = isNumericId
      ? await User.findByPk(userId)
      : await User.findOne({ where: { username: userId } });
    console.log('DEBUG - profileUser.accountType:', profileUser ? profileUser.accountType : 'NÃO DEFINIDO');
  try {
    let userId = req.params.id;

    // If no ID is provided in the URL, try to get it from the session (logged-in user)
    if (!userId) {
      if (!req.session.user) {
        return res.redirect('/login'); // Redirect to login if not logged in
      }
      userId = req.session.user.id;
    }

    const isNumericId = String(userId).match(/^\d+$/);
    const profileUser = isNumericId
      ? await User.findByPk(userId)
      : await User.findOne({ where: { username: userId } });

    if (!profileUser) {
      return res.status(404).send('Usuário não encontrado.');
    }

    // If the logged-in user is viewing their own profile, update the session with the latest data
    if (req.session.user && req.session.user.id === profileUser.id.toString()) {
      req.session.user = {
        id: profileUser.id.toString(),
        username: profileUser.username,
        accountType: profileUser.accountType,
        email: profileUser.email,
        avatar: profileUser.avatar,
        fullName: profileUser.fullName,
        address: profileUser.address,
        businessName: profileUser.businessName,
        documentType: profileUser.documentType,
        documentNumber: profileUser.documentNumber,
        phone: profileUser.phone,
        isVerified: profileUser.isVerified
      };
    }

    const listings = await Listing.findAll({
      where: { sellerId: profileUser.id },
      order: [['createdAt', 'DESC']],
      limit: 5,
      include: [{ model: Card, as: 'card' }]
    });

    // Prepara uma mensagem de erro se a validação do endereço falhou
    let errorMessage = null;
    if (req.query.error === 'validation') {
      errorMessage = 'Falha na validação. Por favor, preencha todos os campos de endereço obrigatórios.';
    }

    const reviews = await Review.findAll({
      where: { sellerId: profileUser.id },
      include: [{ model: User, as: 'buyer', attributes: ['id', 'fullName'] }],
      order: [['createdAt', 'DESC']]
    });

    // Calcula a média das avaliações
    let averageRating = 0;
    if (reviews.length > 0) {
      const totalRating = reviews.reduce((acc, review) => acc + review.rating, 0);
      averageRating = totalRating / reviews.length;
    }

    // Buscar informações da taxa do vendedor (se for vendedor)
    let sellerFeePercentage = null;
    let defaultFeePercentage = null;
    if (profileUser.accountType === 'shop' || profileUser.accountType === 'individual') {
      sellerFeePercentage = profileUser.fee_override_percentage;
      const settingKey = `fee_${profileUser.accountType}_percentage`;
      const defaultFeeSetting = await Setting.findOne({ where: { key: settingKey } });
      defaultFeePercentage = defaultFeeSetting ? defaultFeeSetting.value : 8.0;

      if (sellerFeePercentage === null || sellerFeePercentage === undefined) {
        sellerFeePercentage = defaultFeePercentage;
      }
    }

    // garante que sellerFeePercentage exista para a view (previne ReferenceError)
    res.locals = res.locals || {};
    if (typeof res.locals.sellerFeePercentage === "undefined") res.locals.sellerFeePercentage = null;
    res.render('pages/profile', { 
      profileUser: toPlainWithId(profileUser),
      listings: listings.map(listing => {
        const data = toPlainWithId(listing);
        if (data.card) data.card = addIdAlias(data.card);
        return data;
      }),
      reviews: reviews.map(review => {
        const data = toPlainWithId(review);
        if (data.buyer) data.buyer = addIdAlias(data.buyer);
        return data;
      }),
      averageRating, // Pass the average rating to the view
      error: errorMessage, // Passa a mensagem de erro para a view
      sellerFeePercentage, // Pass seller fee
      defaultFeePercentage, // Pass default fee
      user: req.session.user // Passa o usuário logado para o template
    });

  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).send('Erro no servidor');
  }
};

const showSellPage = async (req, res) => {
  try {
    const allCards = await Card.findAll(); // Fetch all cards from the database
    
    // Buscar informações da taxa do vendedor
    const userId = req.session.user.id;
    const seller = await User.findByPk(userId);
    
    let sellerFeePercentage = seller.fee_override_percentage;
    const settingKey = `fee_${seller.accountType}_percentage`;
    const defaultFeeSetting = await Setting.findOne({ where: { key: settingKey } });
    const defaultFeePercentage = defaultFeeSetting ? defaultFeeSetting.value : 8.0;

    if (sellerFeePercentage === null || sellerFeePercentage === undefined) {
      sellerFeePercentage = defaultFeePercentage;
    }
    
    res.render('pages/sell', { 
      searchResults: allCards,
      sellerFeePercentage: sellerFeePercentage,
      defaultFeePercentage: defaultFeePercentage
    }); // Pass all cards to the view
  } catch (error) {
    console.error('Erro ao carregar a página de venda:', error);
    res.status(500).send('Erro no servidor');
  }
};


const showMyListingsPage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const userId = req.session.user.id;
    const listings = await Listing.findAll({
      where: { sellerId: userId },
      include: [{ model: Card, as: 'card' }]
    });

    // Buscar informações da taxa do vendedor
    const User = require('../models/User');
    const Setting = require('../models/Setting');
    const seller = await User.findByPk(userId);
    
    let sellerFeePercentage = seller.fee_override_percentage;
    const settingKey = `fee_${seller.accountType}_percentage`;
    const defaultFeeSetting = await Setting.findOne({ where: { key: settingKey } });
    const defaultFeePercentage = defaultFeeSetting ? defaultFeeSetting.value : 8.0;

    if (sellerFeePercentage === null || sellerFeePercentage === undefined) {
      sellerFeePercentage = defaultFeePercentage;
    }

    res.render('pages/my-listings', {
      listings: listings.map(listing => {
        const data = toPlainWithId(listing);
        if (data.card) data.card = addIdAlias(data.card);
        return data;
      }),
      sellerFeePercentage: sellerFeePercentage,
      defaultFeePercentage: defaultFeePercentage
    });
  } catch (error) {
    console.error('Error fetching user listings:', error);
    res.status(500).send('Server Error');
  }
};

const showCheckoutSuccessPage = (req, res) => {
  // Pega os totais da sessão, ou usa um objeto zerado como fallback.
  const totals = req.session.totals || { subtotal: 0, shipping: 0, grand: 0 };
  
  // Limpa os totais da sessão para não "vazarem" para a próxima compra.
  delete req.session.totals;

  res.render('pages/checkout-success', { totals });
};



const showMyOrdersPage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const orders = await Order.findAll({
      where: { userId: req.session.user.id },
      order: [['createdAt', 'DESC']]
    });
    const ordersWithCards = await hydrateOrdersWithCards(orders);

    res.render('pages/my-orders', { orders: ordersWithCards });

  } catch (error) {
    console.error('Erro ao buscar pedidos do usuário:', error);
    res.status(500).send('Erro no servidor');
  }
};

const showOrderDetailPage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const orderId = req.params.id;
    const userId = req.session.user.id;

    const order = await Order.findOne({ where: { id: orderId, userId } });

    if (!order) {
      // Renderiza a página de detalhes com uma mensagem de não encontrado
      return res.status(404).render('pages/order-detail', { order: null });
    }

    const [orderWithCards] = await hydrateOrdersWithCards([order]);
    res.render('pages/order-detail', { order: orderWithCards });

  } catch (error) {
    console.error('Erro ao buscar detalhes do pedido:', error);
    res.status(500).send('Erro no servidor');
  }
};

const getEncyclopediaPage = async (req, res) => {
  try {
    // Filtro base para excluir cartas inválidas
    const baseFilter = { 
      game: 'onepiece',
      [Op.and]: [
        { name: { [Op.ne]: null } },
        { name: { [Op.ne]: '' } },
        { name: { [Op.ne]: 'undefined' } }
      ]
    };

    // Filtros vindos da query
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const queryFilters = { ...baseFilter };
    if (req.query.rarity && req.query.rarity !== '') queryFilters.rarity = req.query.rarity;
    if (req.query.color && req.query.color !== '') queryFilters.color = { [Op.iLike]: `%${req.query.color}%` };
    if (req.query.type && req.query.type !== '') queryFilters.type_line = req.query.type;
    if (req.query.set && req.query.set !== '') queryFilters.set_name = { [Op.iLike]: `%${req.query.set}%` };
    if (req.query.q && req.query.q !== '') queryFilters.name = { [Op.iLike]: `%${req.query.q}%` };
    if (req.query.variant && req.query.variant !== '') {
      const variantValue = parseInt(req.query.variant, 10);
      const variantFilter = buildVariantFilter(variantValue);
      applyVariantFilter(queryFilters, variantFilter);
    }
    if (!req.query.variant || req.query.variant === '') {
      const baseFilter = buildVariantFilter(0);
      applyVariantFilter(queryFilters, baseFilter);
    }
    if (req.query.don && req.query.don !== '' && Card.rawAttributes.don) queryFilters.don = req.query.don;

    // Busca as opções de filtro dinamicamente do banco de dados
    const rarities = await distinctValues('rarity', baseFilter);
    const colors = await distinctValues('color', baseFilter);
    const types = await distinctValues('type_line', baseFilter);
    const dons = Card.rawAttributes.don ? await distinctValues('don', baseFilter) : [];

    // Busca e ordena todas as edições
    const rawSets = await distinctValues('set_name', baseFilter);

    function normalizeSetName(setName) {
      const squareBracketMatch = setName.match(/\[([^\]]+)\]/); // Changed to square brackets
      if (squareBracketMatch && squareBracketMatch[1]) {
        return squareBracketMatch[1]; // Return content inside square brackets
      }
      // Fallback to previous normalization if no square brackets found
      const opSetMatch = setName.match(/OP-?(\d+)/);
      if (opSetMatch) {
        return 'OP' + opSetMatch[1].padStart(2, '0');
      }
      return setName; // Return original name if no match
    }

    const setOptions = rawSets.map(setName => ({
      value: normalizeSetName(setName),
      label: normalizeSetName(setName)
    })).sort((a, b) => a.label.localeCompare(b.label));

    // Define os filtros que serão enviados para a view
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
      { name: 'Edição', key: 'set', options: [{ value: '', label: 'Todas' }, ...setOptions] },
      { name: 'DON', key: 'don', options: [{ value: '', label: 'Todos' }, ...dons.filter(Boolean).map(d => ({ value: d, label: d }))] },
      { name: 'Variante', key: 'variant', options: variantOptions }
    ];

    // Paginação e busca de cartas
    const totalCards = await Card.count({ where: queryFilters });
    const cards = await Card.findAll({
      where: queryFilters,
      order: [['name', 'ASC']],
      offset: (page - 1) * limit,
      limit: limit
    });

    res.render('pages/encyclopedia', {
      title: 'Enciclopédia de Cartas',
      filterGroups: filterGroups,
      filters: req.query, // Passa os filtros atuais para a view
      cards,
      currentPage: page,
      hasMore: (page * limit) < totalCards,
      totalCards,
      totalPages: Math.max(1, Math.ceil(totalCards / limit)),
    });
  } catch (error) {
    console.error("Erro ao carregar a página da enciclopédia:", error);
    res.status(500).render('pages/encyclopedia', {
        title: 'Erro',
        filterGroups: [],
        filters: {},
        error: 'Não foi possível carregar os filtros.'
    });
  }
};

const showTimelinePage = async (req, res) => {
  try {
    const sets = await distinctValues('set_name', { game: 'onepiece' });

    const timelineDataPromises = sets.map(async (setName) => {
      const topCard = await Card.findOne({
        where: { set_name: setName, game: 'onepiece' },
        order: [['id', 'DESC']]
      });

      // Extract set code like OP-01 from the set name
      const setCodeMatch = setName.match(/\[(.*?)\]/);
      const setCode = setCodeMatch ? setCodeMatch[1] : '';

      return {
        place: topCard ? topCard.rarity : 'Unknown Rarity',
        title: setName.split('[')[0].trim(),
        title2: setCode,
        description: `A coleção ${setName} apresenta uma variedade de cartas, incluindo raras e poderosas.`,
        image: topCard ? topCard.image_url : '/images/default-avatar.png'
      };
    });

    const timelineData = await Promise.all(timelineDataPromises);

    // Filter out any sets that didn't resolve properly
    const filteredTimelineData = timelineData.filter(item => item.image);

    res.render('pages/visual-timeline', { 
      title: 'Linha do Tempo de Edições', 
      timelineData: JSON.stringify(filteredTimelineData)
    });

  } catch (error) {
    console.error("Error creating visual timeline:", error);
    res.status(500).send("Error creating visual timeline");
  }
};

const showCommunityPage = (req, res) => {
  res.render('pages/community', {
    title: 'Comunidade'
  });
};

const showAboutPage = (req, res) => {
  res.render('pages/about', {
    title: 'Sobre Nós',
    page_css: 'about.css'
  });
};

const showDecksPage = async (req, res) => {
  try {
    const decks = await Deck.findAll({
      include: [{ model: User, as: 'owner', attributes: ['id', 'username'] }],
      order: [['createdAt', 'DESC']]
    });

    res.render('pages/decks', {
      title: 'Decks da Comunidade',
      decks: decks.map(toPlainWithId),
    });
  } catch (error) {
    console.error('Erro ao buscar os decks:', error);
    res.status(500).send('Erro no servidor');
  }
};

const showDeckBuilderPage = async (req, res) => {
  try {
    let deck = null;
    let isOwner = false;

    if (req.params.id) {
      deck = await Deck.findByPk(req.params.id, {
        include: [{ model: User, as: 'owner', attributes: ['id', 'username'] }]
      });
      
      if (!deck) {
        return res.status(404).send('Deck não encontrado.');
      }

      deck = await hydrateDeckWithCards(deck);
      if (req.session.user && deck.owner && deck.owner.id.toString() === req.session.user.id) {
        isOwner = true;
      }
    } else {
      // This is for creating a new deck, so the user is the owner.
      // The isAuthPage middleware already ensures the user is logged in.
      isOwner = true;
    }

    res.render('pages/deck-builder', {
      title: deck ? (isOwner ? 'Editar Deck' : `Ver Deck de ${deck.owner.username}`) : 'Criar Deck',
      page_css: 'deck-builder.css',
      deck: deck,
      isOwner: isOwner
    });
  } catch (error) {
    console.error('Erro ao carregar o deck builder:', error);
    res.status(500).send('Erro no servidor');
  }
};

const showMyDecksPage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const decks = await Deck.findAll({
      where: { ownerId: req.session.user.id },
      order: [['createdAt', 'DESC']]
    });

    res.render('pages/my-decks', {
      title: 'Meus Decks',
      decks: decks.map(toPlainWithId),
    });
  } catch (error) {
    console.error('Erro ao buscar decks do usuário:', error);
    res.status(500).send('Erro no servidor');
  }
};

const showDeckAnalyticsPage = async (req, res) => {
  try {
    const deck = await Deck.findByPk(req.params.id, {
      include: [{ model: User, as: 'owner', attributes: ['id', 'username'] }]
    });

    if (!deck) {
      return res.status(404).send('Deck não encontrado.');
    }

    const hydratedDeck = await hydrateDeckWithCards(deck);

    // Calculate statistics
    const allCards = hydratedDeck.main.map(item => item.card);
    const cardCount = hydratedDeck.main.reduce((sum, item) => sum + item.quantity, 0);
    
    let totalCost = 0;
    hydratedDeck.main.forEach(item => {
      if (item.card && typeof item.card.cost === 'number') {
        totalCost += item.card.cost * item.quantity;
      }
    });
    const averageCost = cardCount > 0 ? totalCost / cardCount : 0;

    const characterCount = hydratedDeck.main.reduce((sum, item) => 
      item.card && item.card.type === 'CHARACTER' ? sum + item.quantity : sum, 0);
      
    const eventCount = hydratedDeck.main.reduce((sum, item) => 
      item.card && item.card.type === 'EVENT' ? sum + item.quantity : sum, 0);

    const colors = new Set();
    const colorCountMap = {};
    hydratedDeck.main.forEach(item => {
      if (item.card && item.card.color) {
        const cardColors = item.card.color.split('/');
        cardColors.forEach(color => {
          colors.add(color);
          colorCountMap[color] = (colorCountMap[color] || 0) + item.quantity;
        });
      }
    });
     if (hydratedDeck.leader.card && hydratedDeck.leader.card.color) {
        const leaderColors = hydratedDeck.leader.card.color.split('/');
        leaderColors.forEach(color => colors.add(color));
    }


    const colorCounts = Object.entries(colorCountMap).map(([color, count]) => `${color}: ${count}`).join(', ');

    const costDistribution = Array(11).fill(0); // Costs 0-10
    hydratedDeck.main.forEach(item => {
      if (item.card && typeof item.card.cost === 'number') {
        const cost = item.card.cost;
        if (cost >= costDistribution.length) {
          costDistribution[costDistribution.length - 1] += item.quantity;
        } else {
          costDistribution[cost] += item.quantity;
        }
      }
    });
    
    const maxCountInDistribution = Math.max(...costDistribution, 1);


    const stats = {
      name: hydratedDeck.title,
      cardCount: cardCount,
      maxCards: 50, // Assuming max 50 for now
      averageCost: averageCost,
      characterCount: characterCount,
      eventCount: eventCount,
      distinctColors: colors.size,
      colorCounts: colorCounts,
      costDistribution: costDistribution,
      maxCountInDistribution: maxCountInDistribution,
    };

    res.render('pages/deck-analytics', {
      title: `Análise do Deck: ${hydratedDeck.title}`,
      deck: hydratedDeck,
      stats,
    });
  } catch (error) {
    console.error('Erro ao carregar a página de análise do deck:', error);
    res.status(500).send('Erro no servidor');
  }
};

module.exports = {
  showHomePage,
  showProfilePage,
  showSellPage,
  showMyListingsPage,
  showCheckoutSuccessPage,
  showMyOrdersPage,
  showOrderDetailPage,
  getEncyclopediaPage,
  showTimelinePage,
  showCommunityPage,
  showAboutPage,
  showDecksPage,
  showDeckBuilderPage,
  showMyDecksPage,
  showDeckAnalyticsPage,
};
