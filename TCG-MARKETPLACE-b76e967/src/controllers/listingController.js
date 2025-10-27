const Listing = require('../models/Listing'); // Importa o modelo de Anúncio
const logger = require('../config/logger');

// Função para criar múltiplos anúncios de uma vez
const bulkCreateListings = async (req, res) => {
  try {
    const { listings: listingsData } = req.body;

    // DEBUG: Inspecionar os dados recebidos
    logger.info('Dados recebidos do frontend:', JSON.stringify(listingsData, null, 2));

    
    // Pega o ID do usuário logado a partir da sessão
    const sellerId = req.session.user.id;

    if (!listingsData || listingsData.length === 0) {
      return res.status(400).json({ message: 'Nenhum anúncio para criar.' });
    }

    // Prepara os dados: mapeia o cardId para o campo 'card' e adiciona o vendedor
    const listingsToSave = listingsData.map(listing => ({
      card: listing.cardId, // Mapeamento de cardId -> card
      seller: sellerId,
      price: listing.price,
      quantity: listing.quantity,
      condition: listing.condition,
      language: listing.language,
      // Adicione outros campos que seu formulário envia, como is_foil, se houver
    }));

    // Usa 'insertMany' do Mongoose para salvar todos os anúncios de uma vez. É super eficiente!
    const createdListings = await Listing.insertMany(listingsToSave);

    // Responde com sucesso
    res.status(201).json({ 
      success: true,
      message: 'Anúncios criados com sucesso!',
      count: createdListings.length 
    });

  } catch (error) {
    logger.error('Erro ao criar anúncios em massa:', error.message);
    logger.error('Stack trace:', error.stack);
    res.status(500).json({ message: 'Erro no servidor ao criar anúncios.' });
  }
};

const showEditListingPage = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).populate('card');
    if (!listing) {
      return res.status(404).send('Anúncio não encontrado.');
    }
    // Authorization: Check if the logged-in user is the seller
    if (listing.seller.toString() !== req.session.user.id) {
      return res.status(403).send('Você não tem permissão para editar este anúncio.');
    }
    res.render('pages/edit-listing', { listing });
  } catch (error) {
    logger.error('Erro ao buscar anúncio para edição:', error);
    res.status(500).send('Erro no servidor');
  }
};

const updateListing = async (req, res) => {
  try {
    const { price, quantity, condition, language } = req.body;
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).send('Anúncio não encontrado.');
    }

    // Authorization: Check if the logged-in user is the seller
    if (listing.seller.toString() !== req.session.user.id) {
      return res.status(403).send('Você não tem permissão para editar este anúncio.');
    }

    listing.price = price;
    listing.quantity = quantity;
    listing.condition = condition;
    listing.language = language;

    await listing.save();

    res.redirect('/meus-anuncios');
  } catch (error) {
    logger.error('Erro ao atualizar anúncio:', error);
    res.status(500).send('Erro no servidor');
  }
};

const deleteListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).send('Anúncio não encontrado.');
    }

    // Authorization: Check if the logged-in user is the seller
    if (listing.seller.toString() !== req.session.user.id) {
      return res.status(403).send('Você não tem permissão para deletar este anúncio.');
    }

    await listing.deleteOne();

    res.redirect('/meus-anuncios');
  } catch (error) {
    logger.error('Erro ao deletar anúncio:', error);
    res.status(500).send('Erro no servidor');
  }
};

module.exports = {
  bulkCreateListings,
  showEditListingPage,
  updateListing,
  deleteListing,
};