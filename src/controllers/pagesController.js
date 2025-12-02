// src/controllers/pagesController.js
const User = require('../models/User');
const Listing = require('../models/Listing');
const Card = require('../models/Card');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Deck = require('../models/Deck');
const Setting = require('../models/Setting');
const showHomePage = async (req, res) => {
  try {
    const recentListings = await Listing.find()
                                        .sort({ createdAt: -1 })
                                        .limit(10)
                                        .populate('card');

    res.render('pages/index', {
      title: 'Bem-vindo ao CardHub',
      recentListings: recentListings,
    });
  } catch (error) {
    console.error('Error fetching recent listings:', error);
    res.status(500).send('Server Error');
  }
};
const showProfilePage = async (req, res) => {
  try {
    let userId = req.params.id;

    // If no ID is provided in the URL, try to get it from the session (logged-in user)
    if (!userId) {
      if (!req.session.user) {
        return res.redirect('/login'); // Redirect to login if not logged in
      }
      userId = req.session.user.id;
    }

    const profileUser = await User.findById(userId);

    if (!profileUser) {
      return res.status(404).send('Usuário não encontrado.');
    }

    // If the logged-in user is viewing their own profile, update the session with the latest data
    if (req.session.user && req.session.user.id === profileUser._id.toString()) {
      req.session.user = {
        id: profileUser._id.toString(), // Ensure ID is a string
        username: profileUser.username,
        accountType: profileUser.accountType,
        address: profileUser.address, // Also update address if it changed
        // Add any other relevant user properties you want to keep in the session
      };
    }

    const listings = await Listing.find({ seller: profileUser._id })
                                  .sort({ createdAt: -1 })
                                  .limit(5)
                                  .populate('card');

    // Prepara uma mensagem de erro se a validação do endereço falhou
    let errorMessage = null;
    if (req.query.error === 'validation') {
      errorMessage = 'Falha na validação. Por favor, preencha todos os campos de endereço obrigatórios.';
    }

    const reviews = await Review.find({ seller: profileUser._id })
                                .populate('buyer', 'fullName') // Popula apenas o fullName do comprador
                                .sort({ createdAt: -1 });

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
      const defaultFeeSetting = await Setting.findOne({ key: settingKey });
      defaultFeePercentage = defaultFeeSetting ? defaultFeeSetting.value : 8.0;

      if (sellerFeePercentage === null || sellerFeePercentage === undefined) {
        sellerFeePercentage = defaultFeePercentage;
      }
    }

    // garante que sellerFeePercentage exista para a view (previne ReferenceError)
    res.locals = res.locals || {};
    if (typeof res.locals.sellerFeePercentage === "undefined") res.locals.sellerFeePercentage = null;
    res.render('pages/profile', { 
      profileUser,
      listings, // Pass the listings to the view
      reviews, // Pass the reviews to the view
      averageRating, // Pass the average rating to the view
      error: errorMessage, // Passa a mensagem de erro para a view
      sellerFeePercentage, // Pass seller fee
      defaultFeePercentage // Pass default fee
    });

  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).send('Erro no servidor');
  }
};

const showSellPage = async (req, res) => {
  try {
    const allCards = await Card.find({}); // Fetch all cards from the database
    
    // Buscar informações da taxa do vendedor
    const userId = req.session.user.id;
    const seller = await User.findById(userId);
    
    let sellerFeePercentage = seller.fee_override_percentage;
    const settingKey = `fee_${seller.accountType}_percentage`;
    const defaultFeeSetting = await Setting.findOne({ key: settingKey });
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
    const listings = await Listing.find({ seller: userId }).populate('card');

    // Buscar informações da taxa do vendedor
    const User = require('../models/User');
    const Setting = require('../models/Setting');
    const seller = await User.findById(userId);
    
    let sellerFeePercentage = seller.fee_override_percentage;
    const settingKey = `fee_${seller.accountType}_percentage`;
    const defaultFeeSetting = await Setting.findOne({ key: settingKey });
    const defaultFeePercentage = defaultFeeSetting ? defaultFeeSetting.value : 8.0;

    if (sellerFeePercentage === null || sellerFeePercentage === undefined) {
      sellerFeePercentage = defaultFeePercentage;
    }

    res.render('pages/my-listings', {
      listings: listings,
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

    const orders = await Order.find({ user: req.session.user.id })
                              .populate('items.card') // Popula os dados dos cards nos itens do pedido
                              .sort({ createdAt: -1 }); // Mais recentes primeiro

    res.render('pages/my-orders', { orders });

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

    const order = await Order.findOne({ _id: orderId, user: userId })
                             .populate('items.card');

    if (!order) {
      // Renderiza a página de detalhes com uma mensagem de não encontrado
      return res.status(404).render('pages/order-detail', { order: null });
    }

    res.render('pages/order-detail', { order });

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
      name: { $exists: true, $ne: null, $ne: '', $ne: 'undefined' }
    };

    // Filtros vindos da query
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const queryFilters = { ...baseFilter };
    if (req.query.rarity && req.query.rarity !== '') queryFilters.rarity = req.query.rarity;
    if (req.query.color && req.query.color !== '') queryFilters.colors = new RegExp(req.query.color, 'i');
    if (req.query.type && req.query.type !== '') queryFilters.type_line = req.query.type;
    if (req.query.set && req.query.set !== '') queryFilters.set_name = new RegExp(req.query.set, 'i');
    if (req.query.q && req.query.q !== '') queryFilters.name = new RegExp(req.query.q, 'i');
    if (req.query.don && req.query.don !== '') queryFilters.don = req.query.don;

    // Busca as opções de filtro dinamicamente do banco de dados
    const rarities = await Card.distinct('rarity', baseFilter);
    const colors = await Card.distinct('colors', baseFilter);
    const types = await Card.distinct('type_line', baseFilter);
    const dons = await Card.distinct('don', baseFilter);

    // Busca e ordena todas as edições
    const rawSets = await Card.distinct('set_name', baseFilter);

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
    const filterGroups = [
      { name: 'Raridade', key: 'rarity', options: [{ value: '', label: 'Todas' }, ...rarities.sort().map(r => ({ value: r, label: r }))] },
      { name: 'Cor', key: 'color', options: [{ value: '', label: 'Todas' }, ...colors.sort().map(c => ({ value: c, label: c }))] },
      { name: 'Tipo', key: 'type', options: [{ value: '', label: 'Todos' }, ...types.sort().map(t => ({ value: t, label: t }))] },
      { name: 'Edição', key: 'set', options: [{ value: '', label: 'Todas' }, ...setOptions] },
      { name: 'DON', key: 'don', options: [{ value: '', label: 'Todos' }, ...dons.filter(Boolean).map(d => ({ value: d, label: d }))] }
    ];

    // Paginação e busca de cartas
    const totalCards = await Card.countDocuments(queryFilters);
    const cards = await Card.find(queryFilters)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

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
    const sets = await Card.distinct('set_name', { game: 'onepiece' });

    const timelineDataPromises = sets.map(async (setName) => {
      const topCard = await Card.findOne({ set_name: setName, game: 'onepiece' })
                                  .sort({ averagePrice: -1 });

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
    const decks = await Deck.find({}).populate('owner', 'username').sort({ createdAt: -1 });

    res.render('pages/decks', {
      title: 'Decks da Comunidade',
      decks,
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
      deck = await Deck.findById(req.params.id)
        .populate('leader.card')
        .populate('main.card')
        .populate('owner', 'username'); // Populate owner's username
      
      if (!deck) {
        return res.status(404).send('Deck não encontrado.');
      }

      if (req.session.user && deck.owner._id.toString() === req.session.user.id) {
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

    const decks = await Deck.find({ owner: req.session.user.id }).sort({ createdAt: -1 });

    res.render('pages/my-decks', {
      title: 'Meus Decks',
      decks,
    });
  } catch (error) {
    console.error('Erro ao buscar decks do usuário:', error);
    res.status(500).send('Erro no servidor');
  }
};

const showDeckAnalyticsPage = async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id)
      .populate('leader.card')
      .populate('main.card')
      .populate('owner', 'username');

    if (!deck) {
      return res.status(404).send('Deck não encontrado.');
    }

    // Calculate statistics
    const allCards = deck.main.map(item => item.card);
    const cardCount = deck.main.reduce((sum, item) => sum + item.quantity, 0);
    
    let totalCost = 0;
    deck.main.forEach(item => {
      if (item.card && typeof item.card.cost === 'number') {
        totalCost += item.card.cost * item.quantity;
      }
    });
    const averageCost = cardCount > 0 ? totalCost / cardCount : 0;

    const characterCount = deck.main.reduce((sum, item) => 
      item.card && item.card.type === 'CHARACTER' ? sum + item.quantity : sum, 0);
      
    const eventCount = deck.main.reduce((sum, item) => 
      item.card && item.card.type === 'EVENT' ? sum + item.quantity : sum, 0);

    const colors = new Set();
    const colorCountMap = {};
    deck.main.forEach(item => {
      if (item.card && item.card.color) {
        const cardColors = item.card.color.split('/');
        cardColors.forEach(color => {
          colors.add(color);
          colorCountMap[color] = (colorCountMap[color] || 0) + item.quantity;
        });
      }
    });
     if (deck.leader.card && deck.leader.card.color) {
        const leaderColors = deck.leader.card.color.split('/');
        leaderColors.forEach(color => colors.add(color));
    }


    const colorCounts = Object.entries(colorCountMap).map(([color, count]) => `${color}: ${count}`).join(', ');

    const costDistribution = Array(11).fill(0); // Costs 0-10
    deck.main.forEach(item => {
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
      name: deck.title,
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
      title: `Análise do Deck: ${deck.title}`,
      deck,
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