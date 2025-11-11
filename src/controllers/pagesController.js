// src/controllers/pagesController.js
const User = require('../models/User');
const Listing = require('../models/Listing');
const Card = require('../models/Card');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Deck = require('../models/Deck');
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

    res.render('pages/profile', { 
      profileUser,
      listings, // Pass the listings to the view
      reviews, // Pass the reviews to the view
      averageRating, // Pass the average rating to the view
      error: errorMessage // Passa a mensagem de erro para a view
    });

  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).send('Erro no servidor');
  }
};

const showSellPage = async (req, res) => {
  try {
    const allCards = await Card.find({}); // Fetch all cards from the database
    res.render('pages/sell', { searchResults: allCards }); // Pass all cards to the view
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

    res.render('pages/my-listings', {
      listings: listings,
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
    // Busca as opções de filtro dinamicamente do banco de dados
    const rarities = await Card.distinct('rarity', { game: 'onepiece' });
    const colors = await Card.distinct('colors', { game: 'onepiece' });
    const types = await Card.distinct('type_line', { game: 'onepiece' });

    // Busca e ordena todas as edições
    const rawSets = await Card.distinct('set_name', { game: 'onepiece' });

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
      value: setName,
      display: normalizeSetName(setName)
    })).sort((a, b) => a.display.localeCompare(b.display));

    // Define os filtros que serão enviados para a view
    const filterGroups = [
      { name: 'Raridade', key: 'rarity', options: rarities.sort() },
      { name: 'Cor', key: 'color', options: colors.sort() },
      { name: 'Tipo', key: 'type', options: types.sort() },
      { name: 'Edição', key: 'set', options: setOptions }
    ];

    res.render('pages/encyclopedia', {
      title: 'Enciclopédia de Cartas',
      filterGroups: filterGroups,
      filters: req.query, // Passa os filtros atuais para a view
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
};