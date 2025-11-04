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
      "-A FIST OF DIVINE SPEED- [OP-11]": 2025,
      "-Anime 25th Collection- [EB-02]": 2025,
      "-BLACK Marshall.D.Teach- [ST-27]": 2025,
      "-BLUE Buggy- [ST-25]": 2025,
      "-GEAR5- [ST-21]": 2025,
      "-GREEN Jewelry Bonney- [ST-24]": 2025,
      "-GREEN/YELLOW Yamato- [ST-28]": 2025,
      "-LEGACY OF THE MASTER- [OP-12]": 2025,
      "-ONE PIECE CARD THE BEST- [PRB-01]": 2025, // Assuming this is "Premium Booster - One Piece Card The Best - Vol. 2"
      "-PURPLE/BLACK Monkey.D.Luffy- [ST-26]": 2025,
      "-RED Shanks- [ST-23]": 2025,
      "-ROYAL BLOOD- [OP-10]": 2025,
      "2025 NEW YEAR EVENT": 2025,
      "Carrying On His Will": 2025, // This is from the web search, not in DB output
      "Learn Together Deck Set": 2025, // This is from the web search, not in DB output
      "Learn Together Deck Set (Zoro Deck)": 2025, // This is from the web search, not in DB output
      "Learn Together Deck Set (Luffy Deck)": 2025, // This is from the web search, not in DB output
      "Learn Together Deck Set (Nami Deck)": 2025, // This is from the web search, not in DB output
      "Starter Deck 22: Ace & Newgate": 2025, // This is from the web search, not in DB output
      "Tournament Kit 2025 Vol.2": 2025,
      "Tournament Pack 2025 Vol. 3": 2025,
      "Treasure Cup February 2025": 2025,
      "Winner Pack 2025 Vol. 3": 2025,
      "Winner Pack 2025 Vol.2": 2025,
      "Offline Regional Participation Pack 2025 Vol.1": 2025,
      "Online Regional Champion Card Set 25-26 Season 1": 2025,
      "Online Regional Finalist Card Set 25-26 Season 1": 2025,
      "Online Regional Participation Pack 25-26 Season 1": 2025,
      "Regional 25-26 Season1": 2025,

      // 2024
      "-3D2Y- [ST-14]": 2024,
      "-500 YEARS IN THE FUTURE- [OP-07]": 2024,
      "-EMPERORS IN THE NEW WORLD- [OP-09]": 2024,
      "-Green Uta- [ST-16]": 2024,
      "-Memorial Collection- [EB-01]": 2024,
      "-Purple Monkey.D.Luffy- [ST-18]": 2024,
      "-Red Edward.Newgate- [ST-15]": 2024,
      "-TWO LEGENDS- [OP-08]": 2024,
      "-Uta-[ST-11]": 2024,
      "-WINGS OF THE CAPTAIN-[OP06]": 2024,
      "-Yellow Charlotte Katakuri- [ST-20]": 2024,
      "-Zoro & Sanji- [ST-12]": 2024,
      "Dreamhack Dallas 2024": 2024,
      "Offline Regional Participation Pack 2024 Vol. 1": 2024,
      "Offline Regional Participation Pack 2024 Vol. 2": 2024,
      "Offline Regional Participation Pack 2024 Vol. 3": 2024,
      "ONE PIECE DAY Dallas -Card Game Celebration-": 2024,
      "Regional 2024 wave1": 2024,
      "Regional 2024 wave2": 2024,
      "Store Treasure Cup August – September 2024": 2024,
      "Tournament Pack 2024 Oct.-Dec.": 2024,
      "Treasure Cup August – September": 2024,

      // 2023
      "-Absolute Justice- [ST-06]": 2023,
      "-Black Smoker- [ST-19]": 2023,
      "-Blue Donquixote Doflamingo- [ST-17]": 2023,
      "-KINGDOMS OF INTRIGUE- [OP04]": 2023,
      "-Monkey D. Luffy-[ST-08]": 2023,
      "-PARAMOUNT WAR- [OP02]": 2023,
      "-PILLARS OF STRENGTH- [OP03]": 2023,
      "-The Seven Warlords of the Sea-[ST-03]": 2023,
      "-The Three Brothers-[ST13]": 2023,
      "-The Three Captains-[ST-10]": 2023,
      "-Worst Generation-[ST-02]": 2023,
      "-Yamato-[ST-09]": 2023,
      "Anime Expo 2023": 2023,
      "Big Mom Pirates [ST-07]": 2023,
      "GIFT COLLECTION 2023 [GC-01]": 2023,
      "OP-05": 2023, // Assuming this is "AWAKENING OF THE NEW ERA [OP-05]"
      "Pre-Release OP03": 2023,
      "Pre-Release OP04": 2023,
      "Sealed Battle 2023 Vol.1": 2023,
      "Sealed Battle Kit Vol.1": 2023,
      "Special Goods Set -Ace/Sabo/Luffy-": 2023,
      "Super Pre-Release": 2023,
      "Winner prize for Sealed Battle 2023 Vol.1": 2023,

      // 2022
      "-Animal Kingdom Pirates-[ST-04]": 2022,
      "-ROMANCE DAWN- [OP01]": 2022,
      "-Straw Hat Crew-[ST-01]": 2022,
      "Included in Promotion Pack 2022": 2022,
      "One Piece Promotion Cards": 2022,
      "One Piece Promotion Cards (Ásia)": 2022,
      "Pre-Release OP02": 2022,
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

    const sortedYears = Object.keys(timeline).sort((a, b) => {
      if (a === 'Unreleased') return 1; // 'Unreleased' always comes last
      if (b === 'Unreleased') return -1;
      return parseInt(a) - parseInt(b);
    });

    const sortedTimeline = {};
    for (const year of sortedYears) {
      sortedTimeline[year] = timeline[year].sort((a, b) => a.setName.localeCompare(b.setName));
    }

    res.render('pages/timeline', { timeline: sortedTimeline, title: 'Linha do Tempo de Edições' });
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