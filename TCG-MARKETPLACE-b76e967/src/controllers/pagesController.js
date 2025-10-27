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
    const username = req.params.username;
    const profileUser = await User.findOne({ username: username });

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
                                .populate('buyer', 'username') // Popula apenas o username do comprador
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
module.exports = {
  showHomePage,
  showProfilePage,
  showSellPage,
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

    // Busca, normaliza e ordena as edições
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

module.exports = {
  showHomePage,
  showProfilePage,
  showSellPage,
  showMyListingsPage,
  showCheckoutSuccessPage,
  showMyOrdersPage,
  showOrderDetailPage,
  getEncyclopediaPage,
};