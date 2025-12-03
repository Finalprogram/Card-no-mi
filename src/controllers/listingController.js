const Listing = require('../models/Listing'); // Importa o modelo de Anúncio
const logger = require('../config/logger');

// Função para criar múltiplos anúncios de uma vez
const bulkCreateListings = async (req, res) => {
  try {
    const { listings: listingsData } = req.body;

    // DEBUG: Inspecionar os dados recebidos
    logger.info('Dados recebidos do frontend:', JSON.stringify(listingsData, null, 2));

    
    // Pega o ID do usuário logado a partir da sessão
    const sellerId = req.session.user ? req.session.user.id : null;

    // Adiciona verificação para garantir que o usuário está logado
    if (!sellerId) {
      return res.status(401).json({ message: 'Sessão de usuário não encontrada ou expirada. Por favor, faça login novamente.' });
    }

    if (!listingsData || listingsData.length === 0) {
      return res.status(400).json({ message: 'Nenhum anúncio para criar.' });
    }

    for (const listing of listingsData) {
      if (parseFloat(listing.price) > 999999) {
        return res.status(400).json({ message: 'O preço de um anúncio não pode exceder R$ 999.999.' });
      }
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
    if (listing.seller.toString() !== req.session.user.id.toString()) {
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
    const { price, quantity, condition, language, is_foil } = req.body;

    if (parseFloat(price) > 999999) {
      req.flash('error_msg', 'O preço do anúncio não pode exceder R$ 999.999.');
      return res.redirect(`/listings/${req.params.id}/edit`);
    }

    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).send('Anúncio não encontrado.');
    }

    // Authorization: Check if the logged-in user is the seller
    if (listing.seller.toString() !== req.session.user.id.toString()) {
      return res.status(403).send('Você não tem permissão para editar este anúncio.');
    }

    listing.price = price;
    listing.quantity = quantity;
    listing.condition = condition;
    listing.language = language;
    listing.is_foil = is_foil === 'on' || is_foil === true || is_foil === 'true';

    await listing.save();

    res.redirect('/meus-anuncios');
  } catch (error) {
    logger.error('Erro ao atualizar anúncio:', error);
    res.status(500).send('Erro no servidor');
  }
};

const deleteListing = async (req, res) => {
  try {
    logger.info(`Attempting to delete listing with ID: ${req.params.id}`);
    logger.info(`User ID from session: ${req.session.user ? req.session.user.id : 'N/A'}`);

    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      logger.warn(`Listing with ID ${req.params.id} not found.`);
      req.flash('error_msg', 'Anúncio não encontrado.');
      return res.status(404).redirect('/meus-anuncios');
    }

    logger.info(`Listing found. Seller ID: ${listing.seller.toString()}`);

    // Authorization: Check if the logged-in user is the seller
    if (!req.session.user || listing.seller.toString() !== req.session.user.id.toString()) {
      logger.warn(`User ${req.session.user ? req.session.user.id : 'N/A'} attempted to delete listing ${req.params.id} without permission.`);
      req.flash('error_msg', 'Você não tem permissão para deletar este anúncio.');
      return res.status(403).redirect('/meus-anuncios');
    }

    const deleteResult = await listing.deleteOne();
    logger.info(`Listing ${req.params.id} deleted. Result: ${JSON.stringify(deleteResult)}`);

    req.flash('success_msg', 'Anúncio deletado com sucesso!');
    res.redirect('/meus-anuncios');
  } catch (error) {
    logger.error('Erro ao deletar anúncio:', error);
    req.flash('error_msg', 'Erro no servidor ao deletar anúncio.');
    res.status(500).redirect('/meus-anuncios');
  }
};

module.exports = {
  bulkCreateListings,
  showEditListingPage,
  updateListing,
  deleteListing,
};