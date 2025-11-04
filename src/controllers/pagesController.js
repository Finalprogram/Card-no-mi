// src/controllers/pagesController.js
const User = require('../models/User');
const Listing = require('../models/Listing');
const Card = require('../models/Card');
const Order = require('../models/Order');
const Review = require('../models/Review');
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

const showSellPage = (req, res) => {
  // Por enquanto, apenas renderizamos a página.
  // No futuro, essa função também vai lidar com os resultados da busca.
  res.render('pages/sell', { searchResults: [] }); // Passamos um array vazio inicialmente
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

    const releaseYears = {
      // 2025
      "Carrying On His Will": 2025,
      "Learn Together Deck Set": 2025,
      "Learn Together Deck Set (Zoro Deck)": 2025,
      "Learn Together Deck Set (Luffy Deck)": 2025,
      "Learn Together Deck Set (Nami Deck)": 2025,
      "Premium Booster - One Piece Card The Best - Vol. 2": 2025,
      "Starter Deck 22: Ace & Newgate": 2025,
      "Legacy of the Master": 2025,
      "Legacy of the Master Release Event Cards": 2025,
      "A Fist of Divine Speed": 2025,
      "A Fist of Divine Speed Release Event Cards": 2025,
      "Starter Deck 28: GREEN/YELLOW Yamato": 2025,
      "Starter Deck 27: BLACK Marshall.D.Teach": 2025,
      "Starter Deck 26: PURPLE/BLACK Monkey.D.Luffy": 2025,
      "Starter Deck 25: BLUE Buggy": 2025,
      "Starter Deck 24: GREEN Jewelry Bonney": 2025,
      "Starter Deck 23: RED Shanks": 2025,
      "Extra Booster: Anime 25th Collection": 2025,
      "Royal Blood": 2025,
      "Royal Blood Release Event Cards": 2025,
      "Starter Deck EX: Gear 5": 2025,

      // 2024
      "Emperors in the New World": 2024,
      "Emperors in the New World: 2nd Anniversary Tournament Cards": 2024,
      "Premium Booster - One Piece Card The Best -": 2024,
      "Starter Deck 20: YELLOW Charlotte Katakuri": 2024,
      "Starter Deck 19: BLACK Smoker": 2024,
      "Starter Deck 18: PURPLE Monkey.D.Luffy": 2024,
      "Starter Deck 17: BLUE Donquixote Doflamingo": 2024,
      "Starter Deck 16: GREEN Uta": 2024,
      "Starter Deck 15: RED Edward.Newgate": 2024,
      "Two Legends": 2024,
      "Two Legends Pre-Release Cards": 2024,
      "Starter Deck 14: 3D2Y": 2024,
      "500 Years in the Future": 2024,
      "500 Years in the Future Pre-Release Cards": 2024,
      "Extra Booster: Memorial Collection": 2024,
      "Ultra Deck: The Three Brothers": 2024,
      "Starter Deck 12: Zoro and Sanji": 2024,
      "Wings of Captain": 2024,
      "Wings of Captain Pre-Release Cards": 2024,
      "Starter Deck 11: Uta": 2024,

      // 2023
      "Awakening of the New Era": 2023,
      "Awakening of the New Era: 1st Anniversary Tournament Cards": 2023,
      "Ultra Deck: The Three Captains": 2023,
      "Kingdoms of Intrigue": 2023,
      "Kingdoms of Intrigue Pre-Release Cards": 2023,
      "Starter Deck 9: Yamato": 2023,
      "Starter Deck 8: Monkey.D.Luffy": 2023,
      "Starter Deck 7: Big Mom Pirates": 2023,
      "Pillars of Strength": 2023,
      "Pillars of Strength Pre-Release Cards": 2023,
      "Starter Deck 6: Absolute Justice": 2023,
      "Paramount War": 2023,
      "Paramount War Pre-Release Cards": 2023,
      "Starter Deck 5: Film Edition": 2023,

      // 2022
      "Starter Deck 4: Animal Kingdom Pirates": 2022,
      "Super Pre-Release Starter Deck 4: Animal Kingdom Pirates": 2022,
      "Starter Deck 3: The Seven Warlords of The Sea": 2022,
      "Super Pre-Release Starter Deck 3: The Seven Warlords of the Sea": 2022,
      "Starter Deck 2: Worst Generation": 2022,
      "Super Pre-Release Starter Deck 2: Worst Generation": 2022,
      "Starter Deck 1: Straw Hat Crew": 2022,
      "Super Pre-Release Starter Deck 1: Straw Hat Crew": 2022,
      "Romance Dawn": 2022,
      "One Piece Promotion Cards (Ásia)": 2022,
      "One Piece Promotion Cards": 2022,
    };

    const timeline = {};

    for (const setName of sets) {
      const year = releaseYears[setName] || 'Unreleased';

      if (!timeline[year]) {
        timeline[year] = [];
      }

      const topCards = await Card.find({ set_name: setName, game: 'onepiece' })
        .sort({ averagePrice: -1 })
        .limit(3);

      timeline[year].push({
        setName,
        topCards,
      });
    }

    res.render('pages/timeline', { timeline, title: 'Linha do Tempo de Edições' });
  } catch (error) {
    console.error("Error creating timeline:", error);
    res.status(500).send("Error creating timeline");
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
};